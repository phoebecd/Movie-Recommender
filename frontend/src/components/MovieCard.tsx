import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { StarRating } from './StarRating'
import { TMDB_POSTER_URL, getMatchBadgeClass, getMatchLabel } from '../types'
import type { Movie } from '../types'

interface Props {
  movie: Movie
  variant: 'recommendation' | 'watched' | 'list'
  matchScore?: number
  userRating?: number
  dateWatched?: Date
  showMatchLabel?: boolean
  whyThisText?: string
  isInWatchLater?: boolean
  isInFavorites?: boolean
  onRatingChange?: (rating: number) => void
}

export function MovieCard({
  movie,
  variant,
  matchScore,
  userRating,
  dateWatched,
  showMatchLabel = true,
  whyThisText,
  isInWatchLater,
  isInFavorites,
  onRatingChange,
}: Props) {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [watchLater, setWatchLater] = useState(isInWatchLater ?? false)
  const [favorited, setFavorited] = useState(isInFavorites ?? false)
  const [showTooltip, setShowTooltip] = useState(false)

  useEffect(() => { setWatchLater(isInWatchLater ?? false) }, [isInWatchLater])
  useEffect(() => { setFavorited(isInFavorites ?? false) }, [isInFavorites])

  const toggleWatchLater = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'watchLater', movie.id)
    try {
      if (watchLater) {
        await deleteDoc(ref)
        setWatchLater(false)
        toast.info(`Removed from Watch Later`)
      } else {
        await setDoc(ref, {
          movieId: movie.id,
          dateAdded: Timestamp.now(),
          matchScoreAtAdd: matchScore ?? 0,
        })
        setWatchLater(true)
        toast.success(`Added to Watch Later`)
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) return
    const ref = doc(db, 'users', user.uid, 'favorites', movie.id)
    try {
      if (favorited) {
        await deleteDoc(ref)
        setFavorited(false)
        toast.info(`Removed from Favorites`)
      } else {
        await setDoc(ref, { movieId: movie.id, dateAdded: Timestamp.now() })
        setFavorited(true)
        toast.success(`Added to Favorites`)
      }
    } catch {
      toast.error('Something went wrong')
    }
  }

  const genres = movie.genres?.slice(0, 3) ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="card overflow-hidden group cursor-pointer"
      onClick={() => navigate(`/movie/${movie.id}`)}
    >
      {/* Poster */}
      <div className="relative w-full aspect-[2/3] bg-zinc-800 overflow-hidden">
        {!imgLoaded && !imgError && <div className="skeleton absolute inset-0" />}
        {!imgError && movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 group-hover:scale-105 transition-transform ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-zinc-600">
            <span className="text-4xl">🎬</span>
            <span className="text-xs text-center px-2">{movie.title}</span>
          </div>
        )}

        {/* Match badge overlay */}
        {variant === 'recommendation' && matchScore !== undefined && showMatchLabel && (
          <div className="absolute top-2 left-2">
            <span className={getMatchBadgeClass(matchScore)}>
              {getMatchLabel(matchScore)}
            </span>
          </div>
        )}

        {/* Why this tooltip */}
        {variant === 'recommendation' && whyThisText && (
          <div className="absolute top-2 right-2">
            <div
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowTooltip((v) => !v) }}
                className="w-6 h-6 rounded-full bg-zinc-900/80 border border-zinc-700 text-zinc-400 text-xs flex items-center justify-center hover:text-white"
              >
                ?
              </button>
              {showTooltip && (
                <div className="absolute right-0 top-7 w-56 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl z-20 text-xs text-zinc-300 leading-relaxed">
                  {whyThisText}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-zinc-100 text-sm leading-tight line-clamp-2">{movie.title}</h3>

        <p className="text-xs text-zinc-500">
          {movie.year} · {movie.runtime ? `${movie.runtime} min` : ''}
        </p>

        {/* Genre chips */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {genres.map((g) => (
              <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Variant-specific content */}
        {variant === 'watched' && userRating !== undefined && (
          <StarRating value={userRating} readOnly size="sm" />
        )}
        {variant === 'watched' && dateWatched && (
          <p className="text-xs text-zinc-600">
            Watched {dateWatched.toLocaleDateString()}
          </p>
        )}
        {variant === 'recommendation' && movie.one_sentence_summary && (
          <p className="text-xs text-zinc-500 italic line-clamp-2">{movie.one_sentence_summary}</p>
        )}

        {/* Action row */}
        <div
          className="flex items-center gap-1 pt-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            id={`watchlater-${movie.id}`}
            onClick={toggleWatchLater}
            title={watchLater ? 'Remove from Watch Later' : 'Add to Watch Later'}
            className={`p-1.5 rounded-lg transition-colors text-base ${watchLater ? 'text-violet-400 bg-violet-500/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            🔖
          </button>
          <button
            id={`favorite-${movie.id}`}
            onClick={toggleFavorite}
            title={favorited ? 'Remove from Favorites' : 'Add to Favorites'}
            className={`p-1.5 rounded-lg transition-colors text-base ${favorited ? 'text-red-400 bg-red-500/10' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800'}`}
          >
            {favorited ? '♥' : '♡'}
          </button>
          <Link
            to={`/movie/${movie.id}`}
            onClick={(e) => e.stopPropagation()}
            className="ml-auto text-xs text-violet-400 hover:text-violet-300 font-medium pr-1"
          >
            Details →
          </Link>
        </div>
      </div>
    </motion.div>
  )
}
