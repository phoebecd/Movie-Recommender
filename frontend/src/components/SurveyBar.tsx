import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
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
  const [selectedFriendUids, setSelectedFriendUids] = useState<string[]>([])
  const [energy, setEnergy] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Fetch friends for blending
  const { data: friends = [] } = useQuery({
    queryKey: ['friends', user?.uid],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users', user!.uid, 'friends'))
      const docs = snap.docs.map(d => d.data() as any)
      const accepted = docs.filter(f => f.status === 'accepted')
      const enriched = await Promise.all(accepted.map(async (f) => {
        const uSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', f.friendUid)))
        return { ...f, userDetails: uSnap.docs[0]?.data() }
      }))
      return enriched
    },
    enabled: !!user && watchingWith[0] === 'Friends'
  })

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
      selectedFriendUids: watchingWith[0] === 'Friends' ? selectedFriendUids : []
    }

    setSurvey(survey)
    setSubmitting(true)
    setLoading(true)

    try {
      let result;
      if (survey.selectedFriendUids?.length) {
        result = await getBlendedRecommendations({ 
          friendUids: survey.selectedFriendUids, 
          survey, 
          excludeMovieIds 
        })
      } else {
        result = await getRecommendations({ survey, excludeMovieIds })
      }
      
      setRecommendations(result.data.recommendations as any)
      setLastFetched(new Date())
      onSubmit?.()
    } catch (err) {
      console.error(err)
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
        {watchingWith[0] === 'Friends' && friends.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
            <p className="label">Select Friends to Blend</p>
            <ChipSelect 
              options={friends.map(f => f.userDetails?.username || 'Unknown')} 
              selected={selectedFriendUids.map(uid => friends.find(f => f.friendUid === uid)?.userDetails?.username || '')} 
              onChange={(names) => {
                const uids = names.map(name => friends.find(f => f.userDetails?.username === name)?.friendUid).filter(Boolean) as string[]
                setSelectedFriendUids(uids)
              }} 
              multi={true} 
            />
          </motion.div>
        )}
        {watchingWith[0] === 'Friends' && friends.length === 0 && (
          <p className="text-[10px] text-zinc-600 italic">Add friends in the Friends tab to use the Blend feature!</p>
        )}
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
