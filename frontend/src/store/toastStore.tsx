import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, 4000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast(msg, 'success'),
  error: (msg: string) => useToastStore.getState().addToast(msg, 'error'),
  info: (msg: string) => useToastStore.getState().addToast(msg, 'info'),
  warning: (msg: string) => useToastStore.getState().addToast(msg, 'warning'),
}

// ─── Toast UI Component ───────────────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const COLORS: Record<ToastType, string> = {
  success: 'border-green-500/40 bg-green-500/10 text-green-300',
  error: 'border-red-500/40 bg-red-500/10 text-red-300',
  info: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
}

const ICON_COLORS: Record<ToastType, string> = {
  success: 'text-green-400',
  error: 'text-red-400',
  info: 'text-violet-400',
  warning: 'text-yellow-400',
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl min-w-[240px] max-w-sm ${COLORS[t.type]}`}
          >
            <span className={`text-sm font-bold ${ICON_COLORS[t.type]}`}>{ICONS[t.type]}</span>
            <span className="text-sm flex-1 text-zinc-100">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-zinc-500 hover:text-zinc-300 text-sm ml-1"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
