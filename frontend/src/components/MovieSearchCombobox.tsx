import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchMovies } from '../lib/tmdb'
import { TMDB_POSTER_URL } from '../types'
import type { TMDBSearchResult } from '../types'

interface Props {
  onSelect: (movie: TMDBSearchResult) => void
  onRemove: (movieId: number) => void
  selected: TMDBSearchResult[]
  maxSelections: number
  placeholder?: string
  label?: string
}

export function MovieSearchCombobox({
  onSelect,
  onRemove,
  selected,
  maxSelections,
  placeholder = 'Search for a movie…',
  label,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TMDBSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    try {
      const res = await searchMovies(q)
      setResults(res.slice(0, 8))
      setOpen(true)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (movie: TMDBSearchResult) => {
    if (selected.length >= maxSelections) return
    if (selected.find((m) => m.id === movie.id)) return
    onSelect(movie)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedIds = new Set(selected.map((m) => m.id))
  const isAtMax = selected.length >= maxSelections

  return (
    <div ref={containerRef} className="space-y-3 relative">
      {label && <label className="label">{label}</label>}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((movie) => (
            <motion.span
              key={movie.id}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              className="flex items-center gap-2 bg-violet-600/20 border border-violet-500/40 text-violet-300 rounded-full px-3 py-1 text-sm"
            >
              {movie.poster_path && (
                <img
                  src={TMDB_POSTER_URL(movie.poster_path)}
                  alt=""
                  className="w-4 h-6 object-cover rounded-sm"
                />
              )}
              <span className="max-w-[120px] truncate">{movie.title}</span>
              <button
                type="button"
                onClick={() => onRemove(movie.id)}
                className="text-violet-400 hover:text-white ml-1 text-xs"
              >
                ✕
              </button>
            </motion.span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInput}
          placeholder={isAtMax ? `Max ${maxSelections} selected` : placeholder}
          disabled={isAtMax}
          className="input-base pr-8 disabled:opacity-40"
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border border-violet-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute z-[100] w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden mt-1 max-h-[300px] overflow-y-auto"
            style={{ top: '100%', left: 0 }}
          >
            {loading && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-zinc-500 italic">Searching TMDB...</div>
            )}
            
            {!loading && results.length === 0 && query.trim().length >= 2 && (
              <div className="px-4 py-3 text-sm text-zinc-500">No results found for "{query}"</div>
            )}

            {results.map((movie) => {
              const year = movie.release_date?.split('-')[0]
              const alreadySelected = selectedIds.has(movie.id)
              return (
                <button
                  key={movie.id}
                  type="button"
                  disabled={alreadySelected || isAtMax}
                  onClick={() => handleSelect(movie)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors disabled:opacity-40 text-left border-b border-zinc-800/50 last:border-b-0"
                >
                  <div className="w-8 h-12 flex-shrink-0 bg-zinc-800 rounded overflow-hidden">
                    {movie.poster_path ? (
                      <img
                        src={TMDB_POSTER_URL(movie.poster_path)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">🎬</div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-100 truncate">{movie.title}</p>
                    <p className="text-xs text-zinc-500">{year} · {movie.vote_average?.toFixed(1)} ★</p>
                  </div>
                  {alreadySelected && (
                    <span className="ml-auto text-violet-400 text-xs flex-shrink-0 font-medium">Added</span>
                  )}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
