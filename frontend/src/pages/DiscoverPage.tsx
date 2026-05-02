import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  collection, query, orderBy, limit, startAfter, getDocs,
  where, QueryDocumentSnapshot, DocumentData
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { Navbar } from '../components/Navbar'
import { MovieCard } from '../components/MovieCard'
import { SkeletonCard } from '../components/SkeletonCard'
import type { Movie } from '../types'

const PAGE_SIZE = 25
const GENRES = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Documentary', 'Animation', 'Foreign', 'Crime', 'Fantasy', 'Mystery']
const SORT_OPTIONS = ['Highest Rated', 'Most Votes', 'Release Date Desc', 'Release Date Asc', 'Alphabetical']

export default function DiscoverPage() {
  const navigate = useNavigate()
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [search, setSearch] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('Highest Rated')
  const sentinelRef = useRef<HTMLDivElement>(null)

  const getOrderField = () => {
    if (sortBy === 'Highest Rated') return { field: 'globalRating', dir: 'desc' as const }
    if (sortBy === 'Most Votes') return { field: 'voteCount', dir: 'desc' as const }
    if (sortBy === 'Release Date Desc') return { field: 'year', dir: 'desc' as const }
    if (sortBy === 'Release Date Asc') return { field: 'year', dir: 'asc' as const }
    return { field: 'title', dir: 'asc' as const }
  }

  const fetchMovies = useCallback(async (reset = false) => {
    if (loading) return
    setLoading(true)
    try {
      const { field, dir } = getOrderField()
      let q = query(
        collection(db, 'movies'),
        orderBy(field, dir),
        limit(PAGE_SIZE)
      )
      if (!reset && lastDoc) {
        q = query(collection(db, 'movies'), orderBy(field, dir), startAfter(lastDoc), limit(PAGE_SIZE))
      }
      const snap = await getDocs(q)
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Movie))
      setMovies((prev) => reset ? docs : [...prev, ...docs])
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setHasMore(snap.docs.length === PAGE_SIZE)
    } finally {
      setLoading(false)
    }
  }, [sortBy, lastDoc, loading])

  // Initial fetch
  useEffect(() => {
    setLastDoc(null)
    setMovies([])
    setHasMore(true)
    fetchMovies(true)
  }, [sortBy])

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !loading) fetchMovies() },
      { threshold: 0.1 }
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [fetchMovies, hasMore, loading])

  const filtered = movies.filter((m) => {
    const matchSearch = !search || m.title?.toLowerCase().includes(search.toLowerCase())
    const matchGenre = selectedGenres.length === 0 || selectedGenres.some((g) => m.genres?.includes(g))
    return matchSearch && matchGenre
  })

  const handleSurpriseMe = () => {
    if (filtered.length === 0) return
    const pick = filtered[Math.floor(Math.random() * filtered.length)]
    navigate(`/movie/${pick.id}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Discover Movies</h1>
            <p className="text-zinc-500 text-sm mt-0.5">Browse the full catalog</p>
          </div>
          <button
            id="surprise-me-btn"
            onClick={handleSurpriseMe}
            className="btn-secondary flex items-center gap-2"
          >
            <span>◎</span> Surprise me
          </button>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-8 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search movies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-base flex-1"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-base sm:w-48"
          >
            {SORT_OPTIONS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>

        {/* Genre chips */}
        <div className="flex flex-wrap gap-2 mb-6">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenres((prev) =>
                prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
              )}
              className={selectedGenres.includes(g) ? 'chip-active' : 'chip-inactive'}
            >
              {g}
            </button>
          ))}
          {selectedGenres.length > 0 && (
            <button onClick={() => setSelectedGenres([])} className="chip-inactive text-red-400">
              Clear filters ✕
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((movie, i) => (
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
            >
              <MovieCard movie={movie} variant="list" />
            </motion.div>
          ))}
          {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
        </div>

        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} className="h-4 mt-8" />
        {!hasMore && movies.length > 0 && (
          <p className="text-center text-zinc-600 text-sm pb-4">— You've reached the end —</p>
        )}
      </main>
    </div>
  )
}
