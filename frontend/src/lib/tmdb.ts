import axios from 'axios'
import type {
  TMDBSearchResult,
  TMDBCredits,
  TMDBVideo,
  TMDBWatchProviders,
} from '../types'

const TMDB_BASE = 'https://api.themoviedb.org/3'

const tmdbClient = axios.create({
  baseURL: TMDB_BASE,
  headers: {
    accept: 'application/json',
  },
})

tmdbClient.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_TMDB_API_KEY
  if (apiKey) {
    // TMDB v3 API expects api_key as a query parameter
    config.params = {
      ...config.params,
      api_key: apiKey
    }
  }
  return config
})

export async function searchMovies(query: string, year?: number): Promise<TMDBSearchResult[]> {
  const params: Record<string, string | number> = { query }
  if (year) params.year = year
  const res = await tmdbClient.get('/search/movie', { params })
  return res.data.results ?? []
}

export async function getMovieCredits(tmdbId: number): Promise<TMDBCredits> {
  const res = await tmdbClient.get(`/movie/${tmdbId}/credits`)
  return res.data
}

export async function getMovieVideos(tmdbId: number): Promise<TMDBVideo[]> {
  const res = await tmdbClient.get(`/movie/${tmdbId}/videos`)
  return res.data.results ?? []
}

export async function getWatchProviders(tmdbId: number): Promise<TMDBWatchProviders | null> {
  const res = await tmdbClient.get(`/movie/${tmdbId}/watch/providers`)
  return res.data.results?.US ?? null
}

export default tmdbClient
