import { useState } from 'react'
import { collection, query, orderBy, getDocs, doc, getDoc } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { Navbar } from '../components/Navbar'
import { MovieCard } from '../components/MovieCard'
import { SkeletonCard } from '../components/SkeletonCard'
import type { Movie, WatchedEntry, WatchLaterEntry, FavoriteEntry } from '../types'

type ListTab = 'watchLater' | 'favorites'

async function fetchWatchLater(uid: string): Promise<Array<{ entry: WatchLaterEntry; movie: Movie | null }>> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'watchLater'), orderBy('dateAdded', 'desc')))
  const entries = snap.docs.map((d) => d.data() as WatchLaterEntry)
  const movies = await Promise.all(
    entries.map(async (e) => {
      const msnap = await getDoc(doc(db, 'movies', e.movieId))
      return msnap.exists() ? { id: msnap.id, ...msnap.data() } as Movie : null
    })
  )
  return entries.map((e, i) => ({ entry: e, movie: movies[i] }))
}

async function fetchFavorites(uid: string): Promise<Array<{ entry: FavoriteEntry; movie: Movie | null }>> {
  const snap = await getDocs(query(collection(db, 'users', uid, 'favorites'), orderBy('dateAdded', 'desc')))
  const entries = snap.docs.map((d) => d.data() as FavoriteEntry)
  const movies = await Promise.all(
    entries.map(async (e) => {
      const msnap = await getDoc(doc(db, 'movies', e.movieId))
      return msnap.exists() ? { id: msnap.id, ...msnap.data() } as Movie : null
    })
  )
  return entries.map((e, i) => ({ entry: e, movie: movies[i] }))
}

export default function MyListPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<ListTab>('watchLater')

  const { data: watchLater = [], isLoading: wlLoading } = useQuery({
    queryKey: ['watchLater', user?.uid],
    queryFn: () => fetchWatchLater(user!.uid),
    enabled: !!user,
    staleTime: 0,
  })

  const { data: favorites = [], isLoading: favLoading } = useQuery({
    queryKey: ['favorites', user?.uid],
    queryFn: () => fetchFavorites(user!.uid),
    enabled: !!user,
    staleTime: 0,
  })

  const loading = tab === 'watchLater' ? wlLoading : favLoading
  const items = tab === 'watchLater'
    ? watchLater.filter((i) => i.movie)
    : favorites.filter((i) => i.movie)

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-6">My List</h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit mb-8">
          {([['watchLater', '🔖 Watch Later'], ['favorites', '♥ Favorites']] as const).map(([t, label]) => (
            <button
              key={t}
              id={`list-tab-${t}`}
              onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-4xl mb-3">{tab === 'watchLater' ? '🔖' : '♥'}</p>
            <p className="text-lg font-medium text-zinc-400">
              {tab === 'watchLater' ? 'No movies in Watch Later' : 'No favorites yet'}
            </p>
            <p className="text-sm mt-1">Browse movies and add them here</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map(({ movie }) => (
              <MovieCard
                key={movie!.id}
                movie={movie!}
                variant="list"
                isInWatchLater={tab === 'watchLater'}
                isInFavorites={tab === 'favorites'}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
