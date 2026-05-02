import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ContextualSurvey } from '../types'

interface SurveyState {
  currentSurvey: ContextualSurvey | null
  setSurvey: (survey: ContextualSurvey) => void
  clearSurvey: () => void
}

export const useSurveyStore = create<SurveyState>()(
  persist(
    (set) => ({
      currentSurvey: null,
      setSurvey: (survey) => set({ currentSurvey: survey }),
      clearSurvey: () => set({ currentSurvey: null }),
    }),
    {
      name: 'moviematch-survey',
    }
  )
)
