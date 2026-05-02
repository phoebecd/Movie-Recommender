import { useState } from 'react'
import { motion } from 'framer-motion'
import { doc, getDoc } from 'firebase/firestore'
import { useQuery } from '@tanstack/react-query'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { Navbar } from '../components/Navbar'
import type { UserProfile, UserStats } from '../types'

export default function ProfilePage() {
  const { user, firestoreUser } = useAuthStore()
  const [tab, setTab] = useState<'account' | 'survey' | 'preferences' | 'stats'>('account')

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid, 'profile', 'data'))
      return snap.exists() ? snap.data() as UserProfile : null
    },
    enabled: !!user,
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', user?.uid],
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', user!.uid, 'stats'))
      return snap.exists() ? snap.data() as UserStats : null
    },
    enabled: !!user,
  })

  const TABS = [
    { key: 'account', label: 'Account' },
    { key: 'survey', label: 'Edit Survey' },
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
            <button key={key} id={`profile-tab-${key}`} onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === key ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}>
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
                  {firestoreUser?.photoUrl
                    ? <img src={firestoreUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
                    : (firestoreUser?.displayName?.[0] ?? '?').toUpperCase()}
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

          {/* ─── Stats ───────────────────────────────────────────────────── */}
          {tab === 'stats' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Movies watched', value: stats?.totalWatched ?? '—', icon: '🎬' },
                { label: 'Avg rating', value: stats?.averageRating?.toFixed(1) ?? '—', icon: '★' },
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
          )}

          {/* ─── Survey / Preferences placeholders ───────────────────────── */}
          {(tab === 'survey' || tab === 'preferences') && (
            <div className="card p-8 text-center text-zinc-500">
              <p className="text-3xl mb-3">⚙</p>
              <p className="font-medium text-zinc-400">{tab === 'survey' ? 'Edit Survey' : 'Preferences'}</p>
              <p className="text-sm mt-1">Coming in the next build increment. Your current settings are from onboarding.</p>
              {profile && (
                <div className="mt-4 text-left max-w-sm mx-auto text-xs text-zinc-600 space-y-1">
                  <p>Genres: {profile.favoriteGenres?.join(', ') || 'none'}</p>
                  <p>Platforms: {profile.platforms?.join(', ') || 'none'}</p>
                  <p>Runtime pref: {profile.preferredRuntime || 'not set'}</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  )
}
