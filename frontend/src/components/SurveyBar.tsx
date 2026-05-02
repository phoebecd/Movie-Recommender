import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { doc, setDoc, Timestamp, getDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { useSurveyStore } from '../store/surveyStore'
import { useRecommendationStore } from '../store/recommendationStore'
import { getRecommendations, getBlendedRecommendations } from '../lib/functions'
import { toast } from '../store/toastStore'
import { ChipSelect } from './ChipSelect'
import type { ContextualSurvey } from '../types'

const MOODS = ['Laugh', 'Cry', 'Think', 'Escape', 'Be Scared', 'Be Inspired', 'Feel Something']
const RUNTIMES = ['Under 90 min', '90–120 min', '2+ hours', 'No limit']
const WATCHING = ['Just me', 'Partner', 'Friends', 'Family']
const ENERGY = ['Low', 'Medium', 'High']

interface Props {
  onSubmit?: () => void
  excludeMovieIds?: string[]
}

export function SurveyBar({ onSubmit, excludeMovieIds = [] }: Props) {
  const { user, firestoreUser } = useAuthStore()
  const { setSurvey } = useSurveyStore()
  const { setRecommendations, setLoading, setLastFetched } = useRecommendationStore()

  const [mood, setMood] = useState<string[]>([])
  const [runtime, setRuntime] = useState<string[]>([])
  const [watchingWith, setWatchingWith] = useState<string[]>([])
  const [energy, setEnergy] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!user) return
    if (!mood.length || !runtime.length || !watchingWith.length || !energy.length) {
      toast.warning('Please fill in all four fields')
      return
    }

    const survey: ContextualSurvey = {
      mood,
      runtime: runtime[0],
      watchingWith: watchingWith[0],
      energyLevel: energy[0],
    }

    setSurvey(survey)
    setSubmitting(true)
    setLoading(true)

    try {
      const result = await getRecommendations({ survey, excludeMovieIds })
      setRecommendations(result.data.recommendations)
      setLastFetched(new Date())
      onSubmit?.()
    } catch (err) {
      toast.error('Could not fetch recommendations — try again')
    } finally {
      setSubmitting(false)
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-zinc-100 text-base">What's the vibe right now?</h2>
        <span className="text-xs text-zinc-500">Pick one per row</span>
      </div>

      <div className="space-y-3">
        <div>
          <p className="label">Mood</p>
          <ChipSelect options={MOODS} selected={mood} onChange={setMood} multi={false} />
        </div>
        <div>
          <p className="label">Time available</p>
          <ChipSelect options={RUNTIMES} selected={runtime} onChange={setRuntime} multi={false} />
        </div>
        <div>
          <p className="label">Watching with</p>
          <ChipSelect options={WATCHING} selected={watchingWith} onChange={setWatchingWith} multi={false} />
        </div>
        <div>
          <p className="label">Energy level</p>
          <ChipSelect options={ENERGY} selected={energy} onChange={setEnergy} multi={false} />
        </div>
      </div>

      <motion.button
        id="find-movies-btn"
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {submitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Finding movies…
          </>
        ) : (
          <>
            <span>✦</span> Find movies
          </>
        )}
      </motion.button>
    </div>
  )
}
