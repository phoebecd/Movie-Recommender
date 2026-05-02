import { useRef } from 'react'
import { motion } from 'framer-motion'
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { useRecommendationStore } from '../store/recommendationStore'
import { Navbar } from '../components/Navbar'
import { SurveyBar } from '../components/SurveyBar'
import { MovieCard } from '../components/MovieCard'
import { SkeletonCard } from '../components/SkeletonCard'
import type { Movie, WatchedEntry } from '../types'

// Fetch top globally-rated movies as fallback
async function fetchTopMovies(): Promise<Movie[]> {
  const q = query(collection(db, 'movies'), orderBy('globalRating', 'desc'), limit(10))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Movie))
}

// Fetch user's watched list with movie data
async function fetchWatched(uid: string): Promise<Array<{ entry: WatchedEntry; movie?: Movie }>> {
  const q = query(
    collection(db, 'users', uid, 'watched'),
    orderBy('dateWatched', 'desc'),
    limit(10)
  )
  const snap = await getDocs(q)
  const entries = snap.docs.map((d) => d.data() as WatchedEntry)

  const movieSnaps = await Promise.all(
    entries.map((e) => getDoc(doc(db, 'movies', e.movieId)))
  )

  return entries.map((entry, i) => ({
    entry,
    movie: movieSnaps[i].exists() ? ({ id: movieSnaps[i].id, ...movieSnaps[i].data() } as Movie) : undefined,
  }))
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const cardVariant = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
}

export default function HomePage() {
  const { user } = useAuthStore()
  const { recommendations, loading: recLoading } = useRecommendationStore()
  const recommendationsRef = useRef<HTMLDivElement>(null)

  const { data: topMovies = [], isLoading: topLoading } = useQuery({
    queryKey: ['movies', 'top'],
    queryFn: fetchTopMovies,
    staleTime: 1000 * 60 * 5,
    enabled: recommendations.length === 0,
  })

  const { data: watched = [] } = useQuery({
    queryKey: ['watched', user?.uid],
    queryFn: () => fetchWatched(user!.uid),
    enabled: !!user,
    staleTime: 0,
  })

  const showFallback = !recLoading && recommendations.length === 0

  const scrollToRecs = () => {
    recommendationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />

      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        {/* Hero */}
        <section>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">
              What are you in the mood for?
            </h1>
            <p className="text-zinc-500 mt-1">Tell us how you're feeling and we'll find the perfect match.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <SurveyBar onSubmit={scrollToRecs} />
          </motion.div>
        </section>

        {/* Recommendations */}
        <section ref={recommendationsRef}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-header">
              {showFallback ? 'Popular Picks' : 'Recommended For Right Now'}
            </h2>
            {showFallback && (
              <span className="text-xs text-zinc-500 bg-zinc-800 border border-zinc-700 px-3 py-1 rounded-full">
                Showing popular picks — personalized recommendations temporarily unavailable
              </span>
            )}
          </div>

          {(recLoading || topLoading) ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
              {(recommendations.length > 0 ? recommendations : topMovies.map((m) => ({
                movieId: m.id,
                confidenceScore: m.globalRating / 10,
                whyThisText: '',
                movie: m,
              }))).map((rec) => {
                const movie = 'movie' in rec ? rec.movie : undefined
                if (!movie) return null
                return (
                  <motion.div key={movie.id} variants={cardVariant}>
                    <MovieCard
                      movie={movie}
                      variant="recommendation"
                      matchScore={'confidenceScore' in rec ? rec.confidenceScore : undefined}
                      whyThisText={'whyThisText' in rec ? rec.whyThisText : undefined}
                      showMatchLabel={recommendations.length > 0}
                    />
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </section>

        {/* Watched */}
        {watched.length > 0 && (
          <section>
            <h2 className="section-header mb-4">Your Watch History</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {watched.map(({ entry, movie }) =>
                movie ? (
                  <MovieCard
                    key={entry.movieId}
                    movie={movie}
                    variant="watched"
                    userRating={entry.rating}
                    dateWatched={entry.dateWatched?.toDate?.()}
                  />
                ) : null
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
