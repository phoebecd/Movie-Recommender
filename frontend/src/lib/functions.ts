import { functions } from './firebase'
import { httpsCallable } from 'firebase/functions'
import type { ContextualSurvey, RecommendationResult, BlendedRecommendationResult, UserProfile, WatchedEntry, UserStub } from '../types'

// ─── Typed callable wrappers ──────────────────────────────────────────────────

export const getRecommendations = httpsCallable<
  { survey: ContextualSurvey; excludeMovieIds?: string[] },
  { recommendations: RecommendationResult[]; cached: boolean }
>(functions, 'getRecommendations')

export const computeUserVector = httpsCallable<
  { profile: Partial<UserProfile>; favoriteMovieVectors?: number[][]; lastWatchedVectors?: number[][] },
  { vector: number[]; clusterLabel: number }
>(functions, 'computeUserVector')

export const getBlendedRecommendations = httpsCallable<
  { friendUids: string[]; survey: ContextualSurvey; excludeMovieIds?: string[] },
  { recommendations: BlendedRecommendationResult[] }
>(functions, 'getBlendedRecommendations')

export const logWatchedMovie = httpsCallable<
  { movieId: string; entry: Omit<WatchedEntry, 'movieId'> },
  { success: boolean }
>(functions, 'logWatchedMovie')

export const updateSurvey = httpsCallable<
  { profile: Partial<UserProfile> },
  { success: boolean }
>(functions, 'updateSurvey')

export const searchUsers = httpsCallable<
  { query: string },
  { users: UserStub[] }
>(functions, 'searchUsers')

export const sendFriendRequest = httpsCallable<
  { targetUid: string },
  { success: boolean }
>(functions, 'sendFriendRequest')

export const acceptFriendRequest = httpsCallable<
  { requesterUid: string },
  { success: boolean }
>(functions, 'acceptFriendRequest')

export const declineFriendRequest = httpsCallable<
  { requesterUid: string },
  { success: boolean }
>(functions, 'declineFriendRequest')
