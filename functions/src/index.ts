import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import axios from 'axios';

admin.initializeApp();
const db = admin.firestore();

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';
const FASTAPI_SECRET = process.env.FASTAPI_SECRET || 'your-shared-secret';

// Helper to check auth
const getAuthUid = (auth: any) => {
  if (!auth) {
    throw new HttpsError('unauthenticated', 'User must be logged in.');
  }
  return auth.uid;
};

// 1. getRecommendations
export const getRecommendations = onCall(async (request) => {
  const uid = getAuthUid(request.auth);
  const { survey, excludeMovieIds = [] } = request.data;

  // Check cache (30-min TTL)
  const cacheRef = db.collection('users').doc(uid).collection('recommendationCache').doc('latest');
  const cacheSnap = await cacheRef.get();

  if (cacheSnap.exists) {
    const cacheData = cacheSnap.data();
    const now = Date.now();
    const cacheTime = cacheData?.timestamp?.toMillis?.() || 0;
    if (now - cacheTime < 30 * 60 * 1000) {
      if (JSON.stringify(cacheData?.survey) === JSON.stringify(survey)) {
        return { recommendations: cacheData?.recommendations, cached: true };
      }
    }
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const userVector = userSnap.data()?.userVector || [];

  try {
    const response = await axios.post(`${FASTAPI_URL}/recommend`, {
      userVector,
      contextualInputs: survey,
      excludeMovieIds,
      limit: 20
    }, {
      headers: { 'Authorization': `Bearer ${FASTAPI_SECRET}` }
    });

    const recommendations = response.data.recommendations;
    const recsWithMovies = await Promise.all(recommendations.map(async (r: any) => {
      const mSnap = await db.collection('movies').doc(r.movieId).get();
      return { ...r, movie: mSnap.exists ? { id: mSnap.id, ...mSnap.data() } : null };
    }));

    const finalRecs = recsWithMovies.filter(r => r.movie !== null);

    await cacheRef.set({
      survey,
      recommendations: finalRecs,
      timestamp: FieldValue.serverTimestamp()
    });

    return { recommendations: finalRecs, cached: false };
  } catch (error) {
    console.error('FastAPI Recommend Error:', error);
    throw new HttpsError('internal', 'ML service error');
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
