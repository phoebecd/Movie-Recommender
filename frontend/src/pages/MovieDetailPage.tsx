import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { getMovieCredits, getMovieVideos, getWatchProviders, getMovieReviews } from '../lib/tmdb'
import { logWatchedMovie } from '../lib/functions'
import { toast } from '../store/toastStore'
import { Navbar } from '../components/Navbar'
import { StarRating } from '../components/StarRating'
import { ChipSelect } from '../components/ChipSelect'
import { SkeletonCard } from '../components/SkeletonCard'
import { TMDB_BACKDROP_URL, TMDB_PROFILE_URL } from '../types'
import type { Movie, WatchedEntry, TMDBCastMember, TMDBReview } from '../types'

const MOOD_CHIPS = ['Laugh', 'Cry', 'Think', 'Escape', 'Be Scared', 'Be Inspired', 'Feel Something']

function CircularRating({ value }: { value: number }) {
  const pct = (value / 10) * 100
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="absolute inset-0" width="80" height="80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgb(39,39,42)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r}
          fill="none"
          stroke={value >= 7 ? 'rgb(134,239,172)' : value >= 5 ? 'rgb(250,204,21)' : 'rgb(248,113,113)'}
          strokeWidth="6"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <div className="text-lg font-bold text-zinc-100">{value.toFixed(1)}</div>
        <div className="text-xs text-zinc-500">TMDB</div>
      </div>
    </div>
  )
}

export default function MovieDetailPage() {
  const { movieId } = useParams<{ movieId: string }>()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [trailerOpen, setTrailerOpen] = useState(false)
  const [markWatchedOpen, setMarkWatchedOpen] = useState(false)
  const [watchedRating, setWatchedRating] = useState(0)
  const [watchedMood, setWatchedMood] = useState<string[]>([])
  const [watchedNote, setWatchedNote] = useState('')
  const [submittingWatch, setSubmittingWatch] = useState(false)

  // ─── Movie data ──────────────────────────────────────────────────────────────
  const { data: movie, isLoading: movieLoading } = useQuery({
    queryKey: ['movie', movieId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'movies', movieId!))
      if (!snap.exists()) throw new Error('Movie not found')
      return { id: snap.id, ...snap.data() } as Movie
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!movieId,
  })

  // ─── User's watched record ───────────────────────────────────────────────────
  const { data: watched } = useQuery({
    queryKey: ['watched-entry', user?.uid, movieId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid, 'watched', movieId!))
      return snap.exists() ? (snap.data() as WatchedEntry) : null
    },
    enabled: !!user && !!movieId,
  })

  // ─── TMDB cast ───────────────────────────────────────────────────────────────
  const { data: credits } = useQuery({
    queryKey: ['credits', movie?.tmdb_id],
    queryFn: () => getMovieCredits(movie!.tmdb_id),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  })

  // ─── TMDB trailer ────────────────────────────────────────────────────────────
  const { data: videos } = useQuery({
    queryKey: ['videos', movie?.tmdb_id],
    queryFn: () => getMovieVideos(movie!.tmdb_id),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  })
  const trailer = videos?.find((v) => v.type === 'Trailer' && v.site === 'YouTube')

  // ─── Watch providers ─────────────────────────────────────────────────────────
  const { data: providers } = useQuery({
    queryKey: ['providers', movie?.tmdb_id],
    queryFn: () => getWatchProviders(movie!.tmdb_id),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  })

  // ─── TMDB reviews ────────────────────────────────────────────────────────────
  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', movie?.tmdb_id],
    queryFn: () => getMovieReviews(movie!.tmdb_id),
    enabled: !!movie?.tmdb_id,
    staleTime: 1000 * 60 * 60,
  })

  // Pick the most substantive review: prefer rated ones, sorted by rating then length
  const bestReview: TMDBReview | null = (() => {
    if (!reviews.length) return null
    const withRating = reviews.filter((r) => r.author_details.rating != null)
    const pool = withRating.length > 0 ? withRating : reviews
    const sorted = [...pool].sort((a, b) => {
      const rd = (b.author_details.rating ?? 0) - (a.author_details.rating ?? 0)
      return rd !== 0 ? rd : b.content.length - a.content.length
    })
    return sorted.find((r) => r.content.length >= 80) ?? sorted[0] ?? null
  })()

  const handleMarkWatched = async () => {
    if (!user || !movieId || watchedRating === 0) {
      toast.warning('Please select a star rating')
      return
    }
    setSubmittingWatch(true)
    try {
      await logWatchedMovie({
        movieId,
        entry: {
          rating: watchedRating,
          dateWatched: Timestamp.now(),
          moodWhenWatched: watchedMood,
          personalNote: watchedNote,
          rewatchCount: 0,
        },
      })
      qc.invalidateQueries({ queryKey: ['watched-entry', user.uid, movieId] })
      qc.invalidateQueries({ queryKey: ['watched', user.uid] })
      toast.success('Logged to your watch history!')
      setMarkWatchedOpen(false)
    } catch {
      toast.error('Failed to log movie')
    } finally {
      setSubmittingWatch(false)
    }
  }

  if (movieLoading) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <Navbar />
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <SkeletonCard />
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Navbar />
        <p className="text-zinc-500">Movie not found</p>
      </div>
    )
  }

  const director = credits?.crew.find((c) => c.job === 'Director')
  const cast = credits?.cast.slice(0, 8) ?? []

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      {/* Backdrop hero */}
      <div className="relative w-full h-72 md:h-96 overflow-hidden">
        {movie.backdropUrl ? (
          <img src={movie.backdropUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-zinc-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-8 pb-6 max-w-screen-xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-2">
            {movie.genres?.map((g) => (
              <span key={g} className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-300">
                {g}
              </span>
            ))}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 tracking-tight leading-tight">{movie.title}</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {movie.year} · {movie.runtime} min{movie.contentRating ? ` · ${movie.contentRating}` : ''}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left — 3/5 */}
          <div className="lg:col-span-3 space-y-6">
            {/* Director + stats row */}
            <div className="flex flex-wrap gap-4 text-sm">
              {(director ?? movie.director) && (
                <span className="text-zinc-400">Directed by <span className="text-zinc-200 font-medium">{director?.name ?? movie.director}</span></span>
              )}
              <span className="text-zinc-400">{movie.language?.toUpperCase()}</span>
            </div>

            {/* Description */}
            <p className="text-zinc-300 leading-relaxed">{movie.description}</p>

            {/* MovieMatch's Take — live TMDB review excerpt */}
            {(bestReview || movie.one_sentence_summary) && (
              <div className="card p-4 bg-violet-900/10 border-violet-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-violet-400 text-sm">✦</span>
                  <span className="text-xs font-semibold text-violet-400 uppercase tracking-wide">MovieMatch's Take</span>
                </div>
                {bestReview ? (
                  <>
                    <p className="text-zinc-300 italic leading-relaxed">
                      "{bestReview.content.length > 300
                        ? bestReview.content.slice(0, 300).trimEnd() + '…'
                        : bestReview.content}"
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-zinc-500">
                        — {bestReview.author_details.name || bestReview.author}
                        {bestReview.author_details.rating != null && (
                          <span className="ml-1.5 text-yellow-400">★ {bestReview.author_details.rating}/10</span>
                        )}
                      </span>
                      <a
                        href={bestReview.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-xs text-violet-400 hover:text-violet-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        via TMDB ↗
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="text-zinc-300 italic leading-relaxed">"{movie.one_sentence_summary}"</p>
                )}
              </div>
            )}

            {/* Trailer button */}
            {trailer && (
              <button
                id="trailer-btn"
                onClick={() => setTrailerOpen(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <span>▶</span> Watch Trailer
              </button>
            )}

            {/* Cast */}
            {cast.length > 0 && (
              <div>
                <h3 className="text-zinc-100 font-semibold mb-3">Cast</h3>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {cast.map((member) => (
                    <div key={member.id} className="flex-shrink-0 w-20 text-center">
                      <div className="w-20 h-20 rounded-full overflow-hidden bg-zinc-800 mx-auto mb-1">
                        {member.profile_path ? (
                          <img
                            src={TMDB_PROFILE_URL(member.profile_path)}
                            alt={member.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xl">👤</div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-200 font-medium leading-tight truncate">{member.name}</p>
                      <p className="text-xs text-zinc-500 truncate">{member.character}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right — 2/5 */}
          <div className="lg:col-span-2 space-y-5">
            {/* TMDB Rating */}
            <div className="card p-4 flex items-center gap-4">
              <CircularRating value={movie.globalRating} />
              <div>
                <p className="text-xs text-zinc-500">Global Rating</p>
                <p className="text-zinc-300 text-sm">{movie.voteCount?.toLocaleString()} votes</p>
              </div>
            </div>

            {/* Platforms */}
            {providers?.flatrate && providers.flatrate.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Where to Watch</p>
                <div className="flex flex-wrap gap-2">
                  {providers.flatrate.map((p) => (
                    <div key={p.provider_id} className="flex items-center gap-1.5 bg-zinc-800 rounded-lg px-3 py-1.5">
                      <img
                        src={`https://image.tmdb.org/t/p/w45${p.logo_path}`}
                        alt={p.provider_name}
                        className="w-5 h-5 rounded"
                      />
                      <span className="text-xs text-zinc-300">{p.provider_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Watch status */}
            {watched ? (
              <div className="card p-4 space-y-3">
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Your Review</p>
                <StarRating value={watched.rating} readOnly />
                {watched.moodWhenWatched?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {watched.moodWhenWatched.map((m) => (
                      <span key={m} className="chip-active text-xs px-2 py-0.5">{m}</span>
                    ))}
                  </div>
                )}
                {watched.personalNote && (
                  <p className="text-zinc-400 text-sm italic">"{watched.personalNote}"</p>
                )}
                <p className="text-xs text-zinc-600">
                  Watched {watched.dateWatched?.toDate?.()?.toLocaleDateString()}
                </p>
              </div>
            ) : (
              <div>
                <button
                  id="mark-watched-btn"
                  onClick={() => setMarkWatchedOpen(true)}
                  className="btn-primary w-full"
                >
                  ✓ Mark as Watched
                </button>

                <AnimatePresence>
                  {markWatchedOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="card p-4 mt-3 space-y-3">
                        <div>
                          <label className="label">Your rating</label>
                          <StarRating value={watchedRating} onChange={setWatchedRating} size="lg" />
                        </div>
                        <div>
                          <label className="label">Mood when you watched</label>
                          <ChipSelect options={MOOD_CHIPS} selected={watchedMood} onChange={setWatchedMood} />
                        </div>
                        <div>
                          <label className="label">Personal note</label>
                          <textarea
                            value={watchedNote}
                            onChange={(e) => setWatchedNote(e.target.value)}
                            placeholder="What did you think?"
                            className="input-base resize-none"
                            rows={2}
                          />
                        </div>
                        <button
                          id="submit-watched-btn"
                          onClick={handleMarkWatched}
                          disabled={submittingWatch}
                          className="btn-primary w-full"
                        >
                          {submittingWatch ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trailer modal */}
      <AnimatePresence>
        {trailerOpen && trailer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
            onClick={() => setTrailerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="w-full max-w-3xl aspect-video rounded-xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <iframe
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1`}
                title="Trailer"
                allowFullScreen
                allow="autoplay"
                className="w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
