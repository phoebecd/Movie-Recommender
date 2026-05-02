import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { signOut } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'

const NAV_LINKS = [
  { to: '/', label: 'Home', icon: '⊞' },
  { to: '/discover', label: 'Discover', icon: '✦' },
  { to: '/movie-of-the-day', label: 'For Tonight', icon: '◎' },
  { to: '/list', label: 'My List', icon: '♡' },
  { to: '/friends', label: 'Friends', icon: '⊕' },
]

export function Navbar() {
  const { user, firestoreUser } = useAuthStore()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    try {
      await signOut(auth)
      toast.success('Signed out successfully')
    } catch {
      toast.error('Failed to sign out')
    }
  }

  return (
    <header className="sticky top-0 z-40 glass border-b border-zinc-800/60">
      <nav className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-violet-400 font-bold text-lg tracking-tight flex-shrink-0">
          <span className="text-violet-500">◈</span>
          <span>MovieMatch</span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1 flex-1">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.to || (link.to !== '/' && location.pathname.startsWith(link.to))
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  active ? 'text-violet-300' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-violet-600/15 rounded-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </Link>
            )
          })}
        </div>

        {/* Right side — profile */}
        <div className="ml-auto flex items-center gap-3">
          <div className="relative">
            <button
              id="nav-avatar-btn"
              onClick={() => setMenuOpen((o) => !o)}
              className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-semibold hover:ring-2 hover:ring-violet-400 transition-all overflow-hidden"
            >
              {firestoreUser?.photoUrl ? (
                <img src={firestoreUser.photoUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                (firestoreUser?.displayName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()
              )}
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-10 w-48 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-50"
                >
                  <div className="px-3 py-2 border-b border-zinc-800">
                    <p className="text-sm font-semibold text-zinc-200 truncate">
                      {firestoreUser?.displayName ?? 'User'}
                    </p>
                    <p className="text-xs text-zinc-500 truncate">@{firestoreUser?.username ?? '…'}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                  >
                    Profile & Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
                  >
                    Sign out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden btn-ghost p-2"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            ☰
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-zinc-800 bg-zinc-900 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === link.to
                      ? 'bg-violet-600/20 text-violet-300'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  <span>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
