import { create } from 'zustand'
import type { Movie, RecommendationResult } from '../types'

interface RecommendationState {
  recommendations: Array<RecommendationResult & { movie?: Movie }>
  loading: boolean
  lastFetched: Date | null
  setRecommendations: (recs: Array<RecommendationResult & { movie?: Movie }>) => void
  setLoading: (loading: boolean) => void
  setLastFetched: (date: Date) => void
  clearRecommendations: () => void
}

export const useRecommendationStore = create<RecommendationState>((set) => ({
  recommendations: [],
  loading: false,
  lastFetched: null,
  setRecommendations: (recommendations) => set({ recommendations }),
  setLoading: (loading) => set({ loading }),
  setLastFetched: (lastFetched) => set({ lastFetched }),
  clearRecommendations: () => set({ recommendations: [], lastFetched: null }),
}))
