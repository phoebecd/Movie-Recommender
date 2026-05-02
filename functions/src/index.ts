import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const FASTAPI_SECRET = process.env.FASTAPI_SECRET || 'your-shared-secret';

// Helper to check auth
const getAuthUid = (auth: any) => {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }
  return auth.uid;
};

// Mood → likely genres mapping for contextual re-ranking
const MOOD_GENRES: Record<string, string[]> = {
  'Laugh':       ['Comedy', 'Animation', 'Family'],
  'Cry':         ['Drama', 'Romance'],
  'Think':       ['Thriller', 'Mystery', 'Science Fiction', 'Documentary'],
  'Escape':      ['Adventure', 'Fantasy', 'Action', 'Science Fiction'],
  'Be Scared':   ['Horror', 'Thriller'],
  'Be Inspired': ['Drama', 'Documentary', 'History'],
  'Feel Something': ['Drama', 'Romance', 'Music'],
};

const RUNTIME_RANGE: Record<string, [number, number]> = {
  'Under 90 min': [0, 90],
  '90–120 min':   [90, 120],
  '2+ hours':     [120, 9999],
  'No limit':     [0, 9999],
};

// Cap results so no single genre dominates the list
function applyGenreCap(recs: any[], maxPerGenre = 4): any[] {
  const counts: Record<string, number> = {};
  return recs.filter((rec) => {
    const primary: string = rec.movie?.genres?.[0];
    if (!primary) return true;
    counts[primary] = (counts[primary] ?? 0) + 1;
    return counts[primary] <= maxPerGenre;
  });
}

function applyContextualScoring(recs: any[], survey: any): any[] {
  const moodGenres = (survey.mood as string[]).flatMap((m) => MOOD_GENRES[m] ?? []);
  const [minRuntime, maxRuntime] = RUNTIME_RANGE[survey.runtime] ?? [0, 9999];

  return recs.map((rec) => {
    const movie = rec.movie;
    let boost = 0;

    // Genre-mood match: +0.15 per matching genre (capped at +0.25)
    const matchedGenres: string[] = (movie.genres ?? []).filter((g: string) => moodGenres.includes(g));
    boost += Math.min(matchedGenres.length * 0.15, 0.25);

    // Runtime penalty: -0.15 if clearly outside selected range
    if (movie.runtime && (movie.runtime < minRuntime || movie.runtime > maxRuntime)) {
      boost -= 0.15;
    }

    // Quality bonus: up to +0.05 based on TMDB rating
    if (movie.globalRating) boost += (movie.globalRating / 200);

    // Build a specific whyThisText
    let whyThisText = rec.whyThisText;
    if (matchedGenres.length > 0) {
      whyThisText = `Matches your ${matchedGenres[0]} taste${matchedGenres.length > 1 ? ` and ${matchedGenres[1]}` : ''} for your ${survey.mood[0]} mood.`;
    } else if (movie.globalRating >= 7.5) {
      whyThisText = `Highly rated ${movie.genres?.[0] ?? 'film'} that fits your taste profile.`;
    }

    return { ...rec, confidenceScore: Math.min(1, Math.max(0, rec.confidenceScore + boost)), whyThisText };
  }).sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// 1. getRecommendations
export const getRecommendations = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { survey, excludeMovieIds = [] } = request.data;

  // Fetch user data + exclusion lists up-front (needed for both cache path and fresh path)
  const [userSnap, favsSnap, watchedSnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('users').doc(uid).collection('favorites').get(),
    db.collection('users').doc(uid).collection('watched').get(),
  ]);

  const userVector = userSnap.data()?.userVector || [];
  const alreadySeenIds = [
    ...favsSnap.docs.map((d) => d.id),
    ...watchedSnap.docs.map((d) => d.id),
    ...excludeMovieIds,
  ];

  // Cache only applies to baseline requests (no user-explicit exclusions).
  // "Not feeling it" always gets a fresh fetch so stale cache can never block it.
  const cacheRef = db.collection('users').doc(uid).collection('recommendationCache').doc('latest');
  if (excludeMovieIds.length === 0) {
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const cacheData = cacheSnap.data();
      const cacheTime = cacheData?.timestamp?.toMillis?.() || 0;
      const surveyMatch = JSON.stringify(cacheData?.survey) === JSON.stringify(survey);
      if (Date.now() - cacheTime < 30 * 60 * 1000 && surveyMatch) {
        const filtered = (cacheData?.recommendations ?? []).filter(
          (r: any) => !alreadySeenIds.includes(r.movieId)
        );
        return { recommendations: filtered, cached: true };
      }
    }
  }

  try {
    const response = await axios.post(`${FASTAPI_URL}/recommend`, {
      userVector,
      contextualInputs: survey,
      excludeMovieIds: alreadySeenIds,
      limit: 30, // fetch extra so contextual filtering has room to work
    }, {
      headers: { 'Authorization': `Bearer ${FASTAPI_SECRET}` },
      timeout: 10000,
    });

    const recommendations = response.data.recommendations;
    const recsWithMovies = await Promise.all(recommendations.map(async (r: any) => {
      const mSnap = await db.collection('movies').doc(r.movieId).get();
      return { ...r, movie: mSnap.exists ? { id: mSnap.id, ...mSnap.data() } : null };
    }));

    const enriched = recsWithMovies.filter((r) => r.movie !== null);
    const finalRecs = applyGenreCap(applyContextualScoring(enriched, survey), 4).slice(0, 20);

    await cacheRef.set({ survey, excludeMovieIds, recommendations: finalRecs, timestamp: FieldValue.serverTimestamp() });
    return { recommendations: finalRecs, cached: false };
  } catch (error) {
    console.error('FastAPI Recommend Error:', error);

    // Fallback: return top-rated movies not already seen
    const fallbackSnap = await db.collection('movies')
      .orderBy('globalRating', 'desc')
      .limit(60)
      .get();

    const fallbackRecs = fallbackSnap.docs
      .filter((d) => !alreadySeenIds.includes(d.id))
      .slice(0, 20)
      .map((d) => ({
        movieId: d.id,
        confidenceScore: (d.data().globalRating ?? 5) / 10,
        whyThisText: `Top-rated ${d.data().genres?.[0] ?? 'film'} you haven\'t seen yet.`,
        movie: { id: d.id, ...d.data() },
      }));

    const fallbackWithContext = applyGenreCap(applyContextualScoring(fallbackRecs, survey), 4).slice(0, 20);
    return { recommendations: fallbackWithContext, cached: false };
  }
});

// 2. computeUserVector
export const computeUserVector = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { profile } = request.data;

  let profileData = profile;
  if (!profileData) {
    const profileSnap = await db.collection('users').doc(uid).collection('profile').doc('data').get();
    if (!profileSnap.exists) throw new HttpsError('not-found', 'Profile not found');
    profileData = profileSnap.data();
  }

  const getVectors = async (movieIds: string[]) => {
    if (!movieIds?.length) return [];
    const docs = await Promise.all(movieIds.map(id => db.collection('movies').doc(id).get()));
    return docs.filter(d => d.exists).map(d => d.data()?.featureVector).filter(v => !!v);
  };

  const favoriteMovieVectors = await getVectors(profileData?.favoriteMovies || []);
  const lastWatchedVectors = await getVectors(profileData?.lastWatched || []);

  try {
    const response = await axios.post(`${FASTAPI_URL}/user-vector`, {
      profile: profileData,
      favoriteMovieVectors,
      lastWatchedVectors
    }, {
      headers: { 'Authorization': `Bearer ${FASTAPI_SECRET}` }
    });

    const { vector, clusterLabel } = response.data;

    await db.collection('users').doc(uid).set({
      userVector: vector,
      clusterLabel,
      lastVectorUpdate: FieldValue.serverTimestamp()
    }, { merge: true });

    return { vector, clusterLabel };
  } catch (error) {
    console.error('FastAPI UserVector Error:', error);
    throw new HttpsError('internal', 'ML service error');
  }
});

// 3. getBlendedRecommendations
export const getBlendedRecommendations = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { friendUids, survey, excludeMovieIds = [] } = request.data;

  const friendVectors = await Promise.all([uid, ...friendUids].map(async (fuid) => {
    if (fuid !== uid) {
      const fSnap = await db.collection('users').doc(uid).collection('friends').doc(fuid).get();
      if (!fSnap.exists || fSnap.data()?.status !== 'accepted') return null;
    }
    const uSnap = await db.collection('users').doc(fuid).get();
    return uSnap.data()?.userVector;
  }));

  const validVectors = friendVectors.filter(v => !!v);

  try {
    const response = await axios.post(`${FASTAPI_URL}/blend`, {
      userVectors: validVectors,
      contextualInputs: survey,
      excludeMovieIds
    }, {
      headers: { 'Authorization': `Bearer ${FASTAPI_SECRET}` }
    });

    const recommendations = response.data.recommendations;
    const recsWithMovies = await Promise.all(recommendations.map(async (r: any) => {
      const mSnap = await db.collection('movies').doc(r.movieId).get();
      return { ...r, movie: mSnap.exists ? { id: mSnap.id, ...mSnap.data() } : null };
    }));

    return { recommendations: recsWithMovies.filter(r => r.movie !== null) };
  } catch (error) {
    console.error('FastAPI Blend Error:', error);
    throw new HttpsError('internal', 'ML service error');
  }
});

// 4. logWatchedMovie
export const logWatchedMovie = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { movieId, entry } = request.data;

  await db.collection('users').doc(uid).collection('watched').doc(movieId).set({
    ...entry,
    movieId,
    dateWatched: FieldValue.serverTimestamp()
  });

  return { success: true };
});

// 5. updateSurvey
export const updateSurvey = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { profile } = request.data;
  await db.collection('users').doc(uid).collection('profile').doc('data').set(profile, { merge: true });
  return { success: true };
});

// 6. searchUsers
export const searchUsers = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { query } = request.data;

  const snap = await db.collection('users')
    .where('username', '>=', query.toLowerCase())
    .where('username', '<=', query.toLowerCase() + '\uf8ff')
    .limit(10)
    .get();

  const users = snap.docs
    .filter(d => d.id !== uid)
    .map(d => {
      const u = d.data();
      return {
        uid: d.id,
        displayName: u.displayName,
        username: u.username,
        photoUrl: u.photoUrl || null
      };
    });

  return { users };
});

// 7. sendFriendRequest
export const sendFriendRequest = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { targetUid } = request.data;

  const targetSnap = await db.collection('users').doc(targetUid).get();
  if (!targetSnap.exists) throw new HttpsError('not-found', 'Target user not found');

  const batch = db.batch();
  const myRef = db.collection('users').doc(uid).collection('friends').doc(targetUid);
  const targetRef = db.collection('users').doc(targetUid).collection('friends').doc(uid);

  batch.set(myRef, { friendUid: targetUid, status: 'pending', initiatedBy: uid, createdAt: FieldValue.serverTimestamp() });
  batch.set(targetRef, { friendUid: uid, status: 'pending', initiatedBy: uid, createdAt: FieldValue.serverTimestamp() });

  await batch.commit();
  return { success: true };
});

// 8. acceptFriendRequest
export const acceptFriendRequest = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { requesterUid } = request.data;

  const batch = db.batch();
  const myRef = db.collection('users').doc(uid).collection('friends').doc(requesterUid);
  const targetRef = db.collection('users').doc(requesterUid).collection('friends').doc(uid);

  batch.update(myRef, { status: 'accepted' });
  batch.update(targetRef, { status: 'accepted' });

  await batch.commit();
  return { success: true };
});

// 9. Stats trigger (v2)
export const updateStats = onDocumentWritten('users/{uid}/watched/{movieId}', async (event) => {
  const uid = event.params.uid;

  const watchedSnap = await db.collection('users').doc(uid).collection('watched').get();
  const watchedDocs = watchedSnap.docs.map(d => d.data());

  if (watchedDocs.length === 0) return;

  const totalWatched = watchedDocs.length;
  const averageRating = watchedDocs.reduce((acc, curr) => acc + (curr.rating || 0), 0) / totalWatched;

  const movieIds = watchedDocs.map(d => d.movieId);
  const movieDocs = await Promise.all(movieIds.map(id => db.collection('movies').doc(id).get()));
  const genres = movieDocs.filter(d => d.exists).flatMap(d => d.data()?.genres || []);

  const genreCounts: Record<string, number> = {};
  genres.forEach(g => genreCounts[g] = (genreCounts[g] || 0) + 1);
  const mostWatchedGenre = Object.keys(genreCounts).reduce((a, b) => genreCounts[a] > genreCounts[b] ? a : b, 'None');

  const highestRated = watchedDocs.reduce((prev, curr) => (prev.rating > curr.rating) ? prev : curr);

  await db.collection('users').doc(uid).set({
    stats: {
      totalWatched,
      averageRating,
      mostWatchedGenre,
      highestRatedMovieId: highestRated.movieId,
      watchStreak: 1
    }
  }, { merge: true });
});
