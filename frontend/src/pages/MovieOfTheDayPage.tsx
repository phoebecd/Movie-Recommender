import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { useSurveyStore } from '../store/surveyStore'
import { getRecommendations } from '../lib/functions'
import { toast } from '../store/toastStore'
import { parseMoodText } from '../utils/moodParser'
import { Navbar } from '../components/Navbar'
import { StarRating } from '../components/StarRating'
import { TMDB_BACKDROP_URL, TMDB_POSTER_URL } from '../types'
import type { Movie, RecommendationResult } from '../types'

const schema = z.object({
  moodText: z.string().max(200).optional(),
  ending: z.string().optional(),
  engagement: z.string().optional(),
  avoidance: z.string().optional(),
  watchingWith: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const ENDINGS = ['Happy', 'Cathartic', "Ambiguous", "I don't mind"]
const ENGAGEMENTS = ['Turn my brain off', 'Light engagement', 'Make me work for it']
const WATCHING = ['Just me', 'Partner', 'Friends', 'Family']

interface ResultMovie {
  movie: Movie
  rec: RecommendationResult
  alternatives: Movie[]
}

export default function MovieOfTheDayPage() {
  const { user } = useAuthStore()
  const [result, setResult] = useState<ResultMovie | null>(null)
  const [loading, setLoading] = useState(false)
  const [excludeIds, setExcludeIds] = useState<string[]>([])
  const [lastFormData, setLastFormData] = useState<FormData | null>(null)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fetchMovie = async (data: FormData, currentExcludeIds: string[]) => {
    if (!user) return
    setLoading(true)
    try {
      const moodTags = parseMoodText(data.moodText ?? '')
      const mood = moodTags.length > 0 ? moodTags : ['Escape']

      const res = await getRecommendations({
        survey: {
          mood,
          runtime: '90–120 min',
          watchingWith: data.watchingWith ?? 'Just me',
          energyLevel: data.engagement === 'Turn my brain off' ? 'Low' : data.engagement === 'Make me work for it' ? 'High' : 'Medium',
        },
        excludeMovieIds: currentExcludeIds,
      })

      // Filter out anything the user has already dismissed, regardless of what the CF returned
      const recs = (res.data.recommendations as any[]).filter(
        (r) => !currentExcludeIds.includes(r.movieId)
      )
      if (!recs.length) { toast.error('No more recommendations — try changing your inputs'); return }

      const [topRec, ...altRecs] = recs
      const topSnap = await getDoc(doc(db, 'movies', topRec.movieId))
      if (!topSnap.exists()) { toast.error('Movie not found'); return }

      const altMovies = await Promise.all(
        altRecs.slice(0, 2).map(async (r) => {
          const s = await getDoc(doc(db, 'movies', r.movieId))
          return s.exists() ? ({ id: s.id, ...s.data() } as Movie) : null
        })
      )

      setResult({
        movie: { id: topSnap.id, ...topSnap.data() } as Movie,
        rec: topRec,
        alternatives: altMovies.filter(Boolean) as Movie[],
      })
    } catch {
      toast.error('Something went wrong — please try again')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: FormData) => {
    setLastFormData(data)
    await fetchMovie(data, excludeIds)
  }

  const handleNotFeeling = async () => {
    if (!result || !lastFormData) return
    // Build the new exclusion list synchronously so fetchMovie sees it immediately
    const newExcludeIds = [...excludeIds, result.movie.id]
    setExcludeIds(newExcludeIds)
    await fetchMovie(lastFormData, newExcludeIds)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Movie For Tonight</h1>
        <p className="text-zinc-500 text-sm mb-8">Tell us how you're feeling and we'll find the perfect film.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Input form */}
          <div className="card p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="label">How are you feeling right now?</label>
                <input
                  {...register('moodText')}
                  type="text"
                  placeholder="e.g. tired and want to laugh, stressed, adventurous…"
                  className="input-base"
                  maxLength={200}
                />
              </div>

              <div>
                <label className="label">What kind of ending do you want?</label>
                <div className="flex flex-wrap gap-2">
                  {ENDINGS.map((e) => (
                    <label key={e} className={`chip cursor-pointer ${watch('ending') === e ? 'chip-active' : 'chip-inactive'}`}>
                      <input type="radio" {...register('ending')} value={e} className="sr-only" />
                      {e}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">How much do you want to think?</label>
                <div className="flex flex-wrap gap-2">
                  {ENGAGEMENTS.map((e) => (
                    <label key={e} className={`chip cursor-pointer ${watch('engagement') === e ? 'chip-active' : 'chip-inactive'}`}>
                      <input type="radio" {...register('engagement')} value={e} className="sr-only" />
                      {e}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Watching with?</label>
                <div className="flex flex-wrap gap-2">
                  {WATCHING.map((e) => (
                    <label key={e} className={`chip cursor-pointer ${watch('watchingWith') === e ? 'chip-active' : 'chip-inactive'}`}>
                      <input type="radio" {...register('watchingWith')} value={e} className="sr-only" />
                      {e}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Anything to avoid tonight?</label>
                <input {...register('avoidance')} type="text" placeholder="e.g. jump scares, sad endings" className="input-base" />
              </div>

              <motion.button
                type="submit"
                whileTap={{ scale: 0.97 }}
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Finding your movie…</>
                ) : (
                  <><span>✦</span> Find my movie</>
                )}
              </motion.button>
            </form>
          </div>

          {/* Result */}
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key={result.movie.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Main result card */}
                <div className="card overflow-hidden">
                  {result.movie.backdropUrl && (
                    <div className="relative h-48">
                      <img src={result.movie.backdropUrl} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent" />
                    </div>
                  )}
                  <div className="p-5 flex gap-4">
                    {result.movie.posterUrl && (
                      <img
                        src={result.movie.posterUrl}
                        alt={result.movie.title}
                        className="w-24 rounded-lg flex-shrink-0 -mt-10 relative z-10 shadow-xl border border-zinc-700"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-bold text-zinc-100">{result.movie.title}</h2>
                      <p className="text-zinc-500 text-sm">{result.movie.year} · {result.movie.runtime} min</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.movie.genres?.slice(0, 3).map((g) => (
                          <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">{g}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 space-y-3">
                    {result.movie.one_sentence_summary && (
                      <p className="text-zinc-300 italic text-base leading-relaxed">
                        "{result.movie.one_sentence_summary}"
                      </p>
                    )}

                    {result.rec.whyThisText && (
                      <div className="bg-violet-900/10 border border-violet-500/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-violet-400 mb-1">Why tonight?</p>
                        <p className="text-zinc-300 text-sm">{result.rec.whyThisText}</p>
                      </div>
                    )}

                    {/* Confidence banner */}
                    <div className={`text-xs font-semibold px-3 py-1.5 rounded-full w-fit ${
                      result.rec.confidenceScore >= 0.8 ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
                      result.rec.confidenceScore >= 0.6 ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' :
                      'bg-zinc-700/50 text-zinc-400 border border-zinc-600'
                    }`}>
                      {result.rec.confidenceScore >= 0.8 ? '✓ Very confident' :
                       result.rec.confidenceScore >= 0.6 ? '✓ Good match' : '↗ Best guess'}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={handleNotFeeling}
                        disabled={loading}
                        className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <><div className="w-3.5 h-3.5 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" /> Finding another…</>
                        ) : (
                          <>Not feeling it ↺</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Alternatives */}
                {result.alternatives.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-2 font-medium">Alternative picks</p>
                    <div className="grid grid-cols-2 gap-3">
                      {result.alternatives.map((alt) => (
                        <div
                          key={alt.id}
                          className="card p-3 flex gap-3 cursor-pointer hover:border-zinc-700 transition-colors"
                          onClick={() => window.location.href = `/movie/${alt.id}`}
                        >
                          {alt.posterUrl && (
                            <img src={alt.posterUrl} alt="" className="w-12 rounded flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-zinc-200 truncate">{alt.title}</p>
                            <p className="text-xs text-zinc-500">{alt.year}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center text-center py-20 text-zinc-600"
              >
                <span className="text-5xl mb-4">◎</span>
                <p className="text-zinc-400 font-medium">Fill in the form to find your movie for tonight</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
