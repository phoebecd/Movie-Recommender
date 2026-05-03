import { useState } from 'react'
import { motion } from 'framer-motion'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { Navbar } from '../components/Navbar'
import type { UserProfile, UserStats, WatchedEntry, Movie } from '../types'

type WatchedWithMovie = { entry: WatchedEntry; movie: Movie | null }

async function fetchWatchedWithMovies(uid: string): Promise<WatchedWithMovie[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'watched'))
  const entries = snap.docs.map((d) => d.data() as WatchedEntry)
  const movies = await Promise.all(
    entries.map(async (e) => {
      const msnap = await getDoc(doc(db, 'movies', e.movieId))
      return msnap.exists() ? ({ id: msnap.id, ...msnap.data() } as Movie) : null
    })
  )
  return entries
    .map((e, i) => ({ entry: e, movie: movies[i] }))
    .sort((a, b) => {
      const diff = (b.entry.rating ?? 0) - (a.entry.rating ?? 0)
      if (diff !== 0) return diff
      return (a.movie?.title ?? '').localeCompare(b.movie?.title ?? '')
    })
}

export default function ProfilePage() {
  const { user, firestoreUser } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'account' | 'watched' | 'preferences' | 'stats'>('account')

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid, 'profile', 'data'))
      return snap.exists() ? (snap.data() as UserProfile) : null
    },
    enabled: !!user,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid))
      return snap.exists() ? (snap.data()?.stats as UserStats) : null
    },
    enabled: !!user,
  })

  const { data: watched = [], isLoading: watchedLoading } = useQuery({
    queryKey: ['watched-ranked', user?.uid],
    queryFn: () => fetchWatchedWithMovies(user!.uid),
    enabled: !!user && tab === 'watched',
    staleTime: 0,
  })

  const { data: highestRatedMovie } = useQuery({
    queryKey: ['highest-rated-movie', stats?.highestRatedMovieId],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'movies', stats!.highestRatedMovieId))
      return snap.exists() ? ({ id: snap.id, ...snap.data() } as Movie) : null
    },
    enabled: !!stats?.highestRatedMovieId,
    staleTime: 1000 * 60 * 5,
  })

  const TABS = [
    { key: 'account', label: 'Account' },
    { key: 'watched', label: 'Watched' },
    { key: 'preferences', label: 'Preferences' },
    { key: 'stats', label: 'Stats' },
  ] as const

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">Profile</h1>

        {/* Tab bar */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit mb-8 flex-wrap">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              id={`profile-tab-${key}`}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          {/* ─── Account ─────────────────────────────────────────────────── */}
          {tab === 'account' && (
            <div className="card p-6 space-y-5 max-w-lg">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-violet-600 flex items-center justify-center text-white text-2xl font-bold overflow-hidden">
                  {firestoreUser?.photoUrl ? (
                    <img src={firestoreUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                  ) : (
                    (firestoreUser?.displayName?.[0] ?? '?').toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-zinc-100">{firestoreUser?.displayName}</p>
                  <p className="text-sm text-zinc-500">@{firestoreUser?.username}</p>
                  <p className="text-sm text-zinc-500">{user?.email}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-xs text-zinc-500">Profile editing, password change, and account deletion are coming soon.</p>
              </div>
            </div>
          )}

          {/* ─── Watched (ranked) ─────────────────────────────────────────── */}
          {tab === 'watched' && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">
                {watched.length > 0 ? `${watched.length} movie${watched.length !== 1 ? 's' : ''} watched · sorted by your rating` : ''}
              </p>

              {watchedLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="card p-4 flex items-center gap-4 animate-pulse">
                      <div className="w-8 h-4 bg-zinc-800 rounded" />
                      <div className="w-12 h-16 bg-zinc-800 rounded-md flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-zinc-800 rounded w-2/3" />
                        <div className="h-3 bg-zinc-800 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : watched.length === 0 ? (
                <div className="card p-10 text-center text-zinc-500">
                  <p className="text-4xl mb-3">🎬</p>
                  <p className="font-medium text-zinc-400">No movies logged yet</p>
                  <p className="text-sm mt-1">Mark movies as watched on their detail page</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {watched.map(({ entry, movie }, idx) => (
                    <button
                      key={entry.movieId}
                      onClick={() => movie && navigate(`/movie/${movie.id}`)}
                      className="card p-4 flex items-center gap-4 w-full text-left hover:border-zinc-600 transition-colors"
                    >
                      {/* Rank */}
                      <span className="text-lg font-bold text-zinc-600 w-8 text-center flex-shrink-0">
                        #{idx + 1}
                      </span>

                      {/* Poster */}
                      <div className="w-12 h-16 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0">
                        {movie?.posterUrl ? (
                          <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-lg">🎬</div>
                        )}
                      </div>

                      {/* Title + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-zinc-100 truncate">{movie?.title ?? entry.movieId}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {movie?.year}
                          {movie?.genres?.[0] ? ` · ${movie.genres[0]}` : ''}
                          {entry.dateWatched?.toDate?.()
                            ? ` · Watched ${entry.dateWatched.toDate().toLocaleDateString()}`
                            : ''}
                        </p>
                        {entry.personalNote ? (
                          <p className="text-xs text-zinc-500 italic mt-1 truncate">"{entry.personalNote}"</p>
                        ) : null}
                      </div>

                      {/* Rating badge */}
                      <div className="flex-shrink-0 text-right">
                        {entry.rating > 0 ? (
                          <div className="flex items-baseline gap-0.5">
                            <span className="text-xl font-bold text-yellow-400">{entry.rating}</span>
                            <span className="text-xs text-zinc-500">/10</span>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-600">unrated</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── Stats ───────────────────────────────────────────────────── */}
          {tab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Movies watched', value: stats?.totalWatched ?? '—', icon: '🎬' },
                  { label: 'Avg rating', value: stats?.averageRating != null ? `${stats.averageRating.toFixed(1)}/10` : '—', icon: '★' },
                  { label: 'Top genre', value: stats?.mostWatchedGenre ?? '—', icon: '🎭' },
                  { label: 'Day streak', value: stats?.watchStreak ?? '—', icon: '🔥' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="card p-5 text-center">
                    <div className="text-3xl mb-2">{icon}</div>
                    <div className="text-2xl font-bold text-zinc-100">{value}</div>
                    <div className="text-xs text-zinc-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {highestRatedMovie && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Your Highest Rated</p>
                  <button
                    onClick={() => navigate(`/movie/${highestRatedMovie.id}`)}
                    className="flex items-center gap-4 w-full text-left hover:opacity-80 transition-opacity"
                  >
                    <div className="w-14 h-20 rounded-md overflow-hidden bg-zinc-800 flex-shrink-0">
                      {highestRatedMovie.posterUrl ? (
                        <img src={highestRatedMovie.posterUrl} alt={highestRatedMovie.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xl">🎬</div>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-100">{highestRatedMovie.title}</p>
                      <p className="text-sm text-zinc-500">{highestRatedMovie.year}</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── Preferences placeholder ─────────────────────────────────── */}
          {tab === 'preferences' && (
            <div className="card p-8 text-center text-zinc-500">
              <p className="text-3xl mb-3">⚙</p>
              <p className="font-medium text-zinc-400">Preferences</p>
              <p className="text-sm mt-1">Review and update your taste profile and content filters.</p>
              {profile && (
                <div className="mt-4 text-left max-w-sm mx-auto text-xs text-zinc-600 space-y-1 mb-6">
                  <p>Genres: {profile.favoriteGenres?.join(', ') || 'none'}</p>
                  <p>Platforms: {profile.platforms?.join(', ') || 'none'}</p>
                  <p>Runtime pref: {profile.preferredRuntime || 'not set'}</p>
                </div>
              )}
              <button onClick={() => navigate('/onboarding')} className="btn-secondary px-6">
                Edit Preferences
              </button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
