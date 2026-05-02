import { Timestamp } from 'firebase/firestore'

// ─── Movie ───────────────────────────────────────────────────────────────────

export interface Movie {
  id: string                    // Firestore document ID
  title: string
  year: number
  runtime: number               // minutes
  genres: string[]
  director: string
  cast: string[]                // top 5
  platforms: string[]
  language: string
  contentRating: string
  description: string
  one_sentence_summary?: string
  tmdb_id: number
  posterUrl: string
  backdropUrl: string
  globalRating: number          // 0–10
  voteCount: number
  featureVector: number[]
  datasetMovie?: boolean        // false if added from TMDB-only
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserDoc {
  displayName: string
  username: string
  email: string
  photoUrl: string | null
  createdAt: Timestamp
  firstLogin: boolean
  clusterLabel: number
  userVector: number[]
  lastVectorUpdate: Timestamp
}

export interface UserProfile {
  favoriteMovies: string[]
  lastWatched: string[]
  favoriteGenres: string[]
  favoriteDecades: string[]
  favoriteActors: string[]
  favoriteDirectors: string[]
  platforms: string[]
  watchingWith: string[]
  watchFrequency: string
  preferredRuntime: string
  subtitlePreference: string
  watchingMotivations: string[]
  avoidanceTags: string[]
  contentWarningFilters: string[]
  updatedAt: Timestamp
}

export interface UserStats {
  totalWatched: number
  averageRating: number
  mostWatchedGenre: string
  watchStreak: number
  highestRatedMovieId: string
}

// ─── Sub-collections ──────────────────────────────────────────────────────────

export interface WatchedEntry {
  movieId: string
  rating: number                // 1–5
  dateWatched: Timestamp
  moodWhenWatched: string[]
  personalNote: string
  rewatchCount: number
}

export interface WatchLaterEntry {
  movieId: string
  dateAdded: Timestamp
  matchScoreAtAdd: number
}

export interface FavoriteEntry {
  movieId: string
  dateAdded: Timestamp
}

export interface FriendDoc {
  friendUid: string
  status: 'pending' | 'accepted'
  initiatedBy: string
  createdAt: Timestamp
}

// ─── Survey / Contextual Inputs ───────────────────────────────────────────────

export interface ContextualSurvey {
  mood: string[]
  runtime: string
  watchingWith: string
  energyLevel: string
  selectedFriendUids?: string[]
}

export interface OnboardingSurvey {
  // Step 1
  favoriteMovies: TMDBSearchResult[]
  lastWatched: TMDBSearchResult[]
  favoriteGenres: string[]
  favoriteDecades: string[]
  // Step 2
  favoriteActors: string[]
  favoriteDirectors: string[]
  platforms: string[]
  // Step 3
  watchingWith: string[]
  watchFrequency: string
  preferredRuntime: string
  subtitlePreference: string
  // Step 4
  watchingMotivations: string[]
  avoidanceTags: string[]
  contentWarningFilters: string[]
}

// ─── Recommendations ──────────────────────────────────────────────────────────

export interface RecommendationResult {
  movieId: string
  confidenceScore: number
  whyThisText: string
}

export interface BlendedRecommendationResult {
  movieId: string
  groupScore: number
  perUserScores: Record<string, number>
  whyThisText: string
}

// ─── TMDB ─────────────────────────────────────────────────────────────────────

export interface TMDBSearchResult {
  id: number
  title: string
  release_date: string
  poster_path: string | null
  backdrop_path: string | null
  overview: string
  vote_average: number
  genre_ids: number[]
}

export interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
}

export interface TMDBCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDBCredits {
  cast: TMDBCastMember[]
  crew: TMDBCrewMember[]
}

export interface TMDBVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
}

export interface TMDBWatchProviderEntry {
  logo_path: string
  provider_id: number
  provider_name: string
  display_priority: number
}

export interface TMDBWatchProviders {
  flatrate?: TMDBWatchProviderEntry[]
  rent?: TMDBWatchProviderEntry[]
  buy?: TMDBWatchProviderEntry[]
  link?: string
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export interface UserStub {
  uid: string
  displayName: string
  username: string
  photoUrl: string | null
}

export type MatchLabel = 'Strong Match' | 'Good Match' | 'Worth a Try'

export function getMatchLabel(score: number): MatchLabel {
  if (score >= 0.8) return 'Strong Match'
  if (score >= 0.6) return 'Good Match'
  return 'Worth a Try'
}

export function getMatchBadgeClass(score: number): string {
  if (score >= 0.8) return 'badge-strong'
  if (score >= 0.6) return 'badge-good'
  return 'badge-try'
}

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'
export const TMDB_POSTER_URL = (path: string) => `${TMDB_IMAGE_BASE}/w500${path}`
export const TMDB_BACKDROP_URL = (path: string) => `${TMDB_IMAGE_BASE}/w1280${path}`
export const TMDB_PROFILE_URL = (path: string) => `${TMDB_IMAGE_BASE}/w185${path}`
