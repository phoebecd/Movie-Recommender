import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import type { UserDoc } from '../types'

/**
 * Initializes Firebase auth listener and syncs to authStore.
 * Must be rendered once at the top of the component tree.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setFirestoreUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        try {
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (snap.exists()) {
            setFirestoreUser(snap.data() as UserDoc)
          }
        } catch {
          // ignore — user doc may not exist yet during signup
        }
      } else {
        setFirestoreUser(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [setUser, setFirestoreUser, setLoading])

  return <>{children}</>
}

/**
 * Wraps protected routes. Redirects to /auth if unauthenticated,
 * redirects to /onboarding if firstLogin === true.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, firestoreUser, loading } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/auth', { replace: true })
      return
    }
    if (firestoreUser?.firstLogin) {
      navigate('/onboarding', { replace: true })
    }
  }, [user, firestoreUser, loading, navigate])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm">Loading MovieMatch…</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return <>{children}</>
}
