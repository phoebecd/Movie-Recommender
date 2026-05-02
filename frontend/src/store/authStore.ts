import { create } from 'zustand'
import type { User } from 'firebase/auth'
import type { UserDoc } from '../types'

interface AuthState {
  user: User | null
  firestoreUser: UserDoc | null
  loading: boolean
  setUser: (user: User | null) => void
  setFirestoreUser: (firestoreUser: UserDoc | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  firestoreUser: null,
  loading: true,
  setUser: (user) => set({ user }),
  setFirestoreUser: (firestoreUser) => set({ firestoreUser }),
  setLoading: (loading) => set({ loading }),
}))
