import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { updateSurvey, computeUserVector } from '../lib/functions'
import { toast } from '../store/toastStore'
import { ChipSelect } from '../components/ChipSelect'
import { MovieSearchCombobox } from '../components/MovieSearchCombobox'
import type { TMDBSearchResult } from '../types'

const STEPS = ['Taste in Film', 'People', 'How You Watch', 'Vibe']

const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Documentary', 'Animation', 'Foreign', 'Crime', 'Fantasy', 'Mystery']
const DECADES = ['Pre-1970s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']
const PLATFORMS = ['Netflix', 'Hulu', 'HBO Max', 'Prime Video', 'Disney+', 'Apple TV+', 'Peacock', 'Paramount+', 'Showtime']
const WATCHING_WITH = ['Solo', 'Partner', 'Friends', 'Family', 'Mixed']
const FREQUENCY = ['Daily', 'A few times a week', 'Weekends only', 'Rarely']
const RUNTIME = ['Under 90 min', '90–120 min', '120–150 min', 'No preference']
const SUBTITLES = ['Love them', 'Fine with them', 'Prefer to avoid', 'Never']
const MOTIVATIONS = ['Escapism', 'Inspiration', 'A good cry', 'Laughs', 'Intellectual stimulation', 'Background noise', 'Shared experience']
const CONTENT_WARNINGS = ['Sexual content', 'Extreme violence', 'Animal harm', 'Child harm']

function TagInput({ value, onChange, max, placeholder }: { value: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string }) {
  const [input, setInput] = useState('')
  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed) && value.length < max) {
      onChange([...value, trimmed])
      setInput('')
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? `Type and press Enter (max ${max})`}
          disabled={value.length >= max}
          className="input-base flex-1"
        />
        <button type="button" onClick={add} disabled={value.length >= max} className="btn-secondary px-3">Add</button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((tag) => (
            <span key={tag} className="chip-active flex items-center gap-1.5">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== tag))} className="text-violet-400 hover:text-white text-xs">✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Step 1
  const [favMovies, setFavMovies] = useState<TMDBSearchResult[]>([])
  const [lastWatched, setLastWatched] = useState<TMDBSearchResult[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [decades, setDecades] = useState<string[]>([])

  // Step 2
  const [actors, setActors] = useState<string[]>([])
  const [directors, setDirectors] = useState<string[]>([])
  const [platforms, setPlatforms] = useState<string[]>([])

  // Step 3
  const [watchingWith, setWatchingWith] = useState<string[]>([])
  const [frequency, setFrequency] = useState<string[]>([])
  const [runtime, setRuntime] = useState<string[]>([])
  const [subtitles, setSubtitles] = useState<string[]>([])

  // Step 4
  const [motivations, setMotivations] = useState<string[]>([])
  const [avoidanceTags, setAvoidanceTags] = useState<string[]>([])
  const [contentWarnings, setContentWarnings] = useState<string[]>([])

  const removeMovie = (list: TMDBSearchResult[], setter: (v: TMDBSearchResult[]) => void, id: number) =>
    setter(list.filter((m) => m.id !== id))

  const canProceed = () => {
    if (step === 0) return favMovies.length > 0 && genres.length > 0
    if (step === 1) return platforms.length > 0
    if (step === 2) return watchingWith.length > 0 && frequency.length > 0 && runtime.length > 0 && subtitles.length > 0
    if (step === 3) return motivations.length > 0
    return true
  }

  const handleFinish = async () => {
    if (!user) return
    setSubmitting(true)

    try {
      await updateSurvey({
        profile: {
          favoriteMovies: favMovies.map((m) => String(m.id)),
          lastWatched: lastWatched.map((m) => String(m.id)),
          favoriteGenres: genres,
          favoriteDecades: decades,
          favoriteActors: actors,
          favoriteDirectors: directors,
          platforms,
          watchingWith,
          watchFrequency: frequency[0] ?? '',
          preferredRuntime: runtime[0] ?? '',
          subtitlePreference: subtitles[0] ?? '',
          watchingMotivations: motivations,
          avoidanceTags,
          contentWarningFilters: contentWarnings,
          updatedAt: new Date().toISOString(),
        },
      })
      await computeUserVector({ 
        profile: {
          favoriteMovies: favMovies.map(m => String(m.id)),
          lastWatched: lastWatched.map(m => String(m.id)),
          favoriteGenres: genres,
          favoriteActors: actors,
          favoriteDirectors: directors
        } 
      })
      await updateDoc(doc(db, 'users', user.uid), { firstLogin: false })
      
      // Update local state so AuthGuard doesn't redirect back
      useAuthStore.getState().setFirestoreUser({
        ...(useAuthStore.getState().firestoreUser || {}),
        firstLogin: false
      } as any)

      navigate('/home', { replace: true })
    } catch (err) {
      console.error('Onboarding Error:', err)
      toast.error('Failed to save preferences — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    // Step 1 ─────────────────────────────────────────────────
    <div key="step1" className="space-y-6">
      <div className="relative">
        <MovieSearchCombobox
          label="Top 5 favorite movies of all time"
          selected={favMovies}
          onSelect={(m) => setFavMovies((prev) => [...prev, m])}
          onRemove={(id) => removeMovie(favMovies, setFavMovies, id)}
          maxSelections={5}
          placeholder="Search TMDB…"
        />
      </div>

      <div className="relative">
        <MovieSearchCombobox
          label="Last 5 movies you watched"
          selected={lastWatched}
          onSelect={(m) => setLastWatched((prev) => [...prev, m])}
          onRemove={(id) => removeMovie(lastWatched, setLastWatched, id)}
          maxSelections={5}
          placeholder="Search TMDB…"
        />
      </div>

      <div>
        <label className="label">Favorite genres <span className="text-red-400">*</span></label>
        <ChipSelect options={GENRES} selected={genres} onChange={setGenres} />
      </div>

      <div>
        <label className="label">Favorite decades</label>
        <ChipSelect options={DECADES} selected={decades} onChange={setDecades} />
      </div>
    </div>,

    // Step 2 ─────────────────────────────────────────────────
    <div key="step2" className="space-y-6">
      <div>
        <label className="label">Favorite actors (up to 5)</label>
        <TagInput value={actors} onChange={setActors} max={5} placeholder="Type a name and press Enter" />
      </div>
      <div>
        <label className="label">Favorite directors (up to 3)</label>
        <TagInput value={directors} onChange={setDirectors} max={3} placeholder="e.g. Christopher Nolan" />
      </div>
      <div>
        <label className="label">Streaming platforms you have <span className="text-red-400">*</span></label>
        <ChipSelect options={PLATFORMS} selected={platforms} onChange={setPlatforms} />
      </div>
    </div>,

    // Step 3 ─────────────────────────────────────────────────
    <div key="step3" className="space-y-6">
      {[
        { label: 'Who do you usually watch with?', options: WATCHING_WITH, sel: watchingWith, set: setWatchingWith, multi: true },
        { label: 'How often do you watch movies?', options: FREQUENCY, sel: frequency, set: setFrequency, multi: false },
        { label: 'Preferred movie length', options: RUNTIME, sel: runtime, set: setRuntime, multi: false },
        { label: 'Subtitles?', options: SUBTITLES, sel: subtitles, set: setSubtitles, multi: false },
      ].map(({ label, options, sel, set, multi }) => (
        <div key={label}>
          <label className="label">{label} <span className="text-red-400">*</span></label>
          <ChipSelect options={options} selected={sel} onChange={set} multi={multi} />
        </div>
      ))}
    </div>,

    // Step 4 ─────────────────────────────────────────────────
    <div key="step4" className="space-y-6">
      <div>
        <label className="label">What do you watch movies for? <span className="text-red-400">*</span></label>
        <ChipSelect options={MOTIVATIONS} selected={motivations} onChange={setMotivations} />
      </div>
      <div>
        <label className="label">Things you almost always avoid (up to 5)</label>
        <TagInput value={avoidanceTags} onChange={setAvoidanceTags} max={5} placeholder='e.g. "jump scares", "slow burns"' />
      </div>
      <div>
        <label className="label">Content warnings to always filter out</label>
        <ChipSelect options={CONTENT_WARNINGS} selected={contentWarnings} onChange={setContentWarnings} />
      </div>
    </div>,
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-3xl">◈</span>
          <h1 className="text-2xl font-bold text-zinc-100 mt-2">Set up your taste profile</h1>
          <p className="text-zinc-500 text-sm mt-1">Step {step + 1} of {STEPS.length} — {STEPS[step]}</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-8">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-violet-500' : 'bg-zinc-800'}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="card p-6 mb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <div />
          {step < STEPS.length - 1 ? (
            <button
              id="onboarding-next"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="btn-primary px-8"
            >
              Continue →
            </button>
          ) : (
            <button
              id="onboarding-finish"
              onClick={handleFinish}
              disabled={!canProceed() || submitting}
              className="btn-primary px-8"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving…
                </span>
              ) : (
                'Start watching ✓'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
