import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth'
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { toast } from '../store/toastStore'
import type { UserDoc } from '../types'

// ─── Schemas ─────────────────────────────────────────────────────────────────

const signInSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signUpSchema = z.object({
  displayName: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string()
    .min(3, 'Username must be 3–20 characters')
    .max(20, 'Username must be 3–20 characters')
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers, underscores only'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type SignInData = z.infer<typeof signInSchema>
type SignUpData = z.infer<typeof signUpSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function createUserDoc(uid: string, data: Partial<UserDoc>) {
  await setDoc(doc(db, 'users', uid), {
    displayName: data.displayName ?? '',
    username: data.username ?? '',
    email: data.email ?? '',
    photoUrl: data.photoUrl ?? null,
    createdAt: Timestamp.now(),
    firstLogin: true,
    clusterLabel: -1,
    userVector: [],
    lastVectorUpdate: Timestamp.now(),
    ...data,
  })
}

// ─── Auth Page ────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'signin' | 'signup'>('signin')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  // ── Sign-in form ──
  const signInForm = useForm<SignInData>({ resolver: zodResolver(signInSchema) })
  const signUpForm = useForm<SignUpData>({ resolver: zodResolver(signUpSchema) })

  const postAuthRedirect = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists() && snap.data().firstLogin) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }

  const onSignIn = async (data: SignInData) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, data.email, data.password)
      await postAuthRedirect(cred.user.uid)
    } catch (err: any) {
      toast.error(err.code === 'auth/invalid-credential' ? 'Wrong email or password' : 'Sign in failed')
    }
  }

  const onSignUp = async (data: SignUpData) => {
    // Check username uniqueness
    try {
      const existing = await getDoc(doc(db, 'usernames', data.username))
      if (existing.exists()) {
        signUpForm.setError('username', { message: 'Username is taken' })
        return
      }
    } catch {}

    try {
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password)
      await createUserDoc(cred.user.uid, {
        displayName: data.displayName,
        username: data.username,
        email: data.email,
      })
      // Reserve username
      await setDoc(doc(db, 'usernames', data.username), { uid: cred.user.uid })
      navigate('/onboarding', { replace: true })
    } catch (err: any) {
      toast.error(err.code === 'auth/email-already-in-use' ? 'Email already in use' : 'Sign up failed')
    }
  }

  const onGoogleAuth = async () => {
    setLoadingGoogle(true)
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (!snap.exists()) {
        const base = cred.user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'user'
        await createUserDoc(cred.user.uid, {
          displayName: cred.user.displayName ?? '',
          username: base.slice(0, 20),
          email: cred.user.email ?? '',
          photoUrl: cred.user.photoURL,
        })
        navigate('/onboarding', { replace: true })
      } else {
        await postAuthRedirect(cred.user.uid)
      }
    } catch {
      toast.error('Google sign-in failed')
    } finally {
      setLoadingGoogle(false)
    }
  }

  const onResetPassword = async () => {
    if (!resetEmail) return
    try {
      await sendPasswordResetEmail(auth, resetEmail)
      toast.success('Reset email sent — check your inbox')
      setShowReset(false)
    } catch {
      toast.error('Could not send reset email')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl">◈</span>
          <h1 className="text-3xl font-bold text-zinc-100 mt-3 tracking-tight">MovieMatch</h1>
          <p className="text-zinc-500 mt-1 text-sm">Find the perfect movie for any mood</p>
        </div>

        <div className="card p-6">
          {/* Tabs */}
          <div className="flex rounded-lg bg-zinc-800 p-1 mb-6">
            {(['signin', 'signup'] as const).map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-all ${
                  tab === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {tab === 'signin' ? (
              <motion.form
                key="signin"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={signInForm.handleSubmit(onSignIn)}
                className="space-y-4"
              >
                <div>
                  <label className="label" htmlFor="signin-email">Email</label>
                  <input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    className="input-base"
                    {...signInForm.register('email')}
                  />
                  {signInForm.formState.errors.email && (
                    <p className="text-red-400 text-xs mt-1">{signInForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0" htmlFor="signin-password">Password</label>
                    <button type="button" onClick={() => setShowReset(true)} className="text-xs text-violet-400 hover:text-violet-300">
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    className="input-base"
                    {...signInForm.register('password')}
                  />
                  {signInForm.formState.errors.password && (
                    <p className="text-red-400 text-xs mt-1">{signInForm.formState.errors.password.message}</p>
                  )}
                </div>
                <button
                  id="signin-submit"
                  type="submit"
                  disabled={signInForm.formState.isSubmitting}
                  className="btn-primary w-full"
                >
                  {signInForm.formState.isSubmitting ? 'Signing in…' : 'Sign In'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="signup"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={signUpForm.handleSubmit(onSignUp)}
                className="space-y-4"
              >
                {[
                  { id: 'signup-name', label: 'Display name', field: 'displayName' as const, type: 'text', placeholder: 'Your name' },
                  { id: 'signup-username', label: 'Username', field: 'username' as const, type: 'text', placeholder: 'lowercase only' },
                  { id: 'signup-email', label: 'Email', field: 'email' as const, type: 'email', placeholder: 'you@example.com' },
                  { id: 'signup-password', label: 'Password', field: 'password' as const, type: 'password', placeholder: '••••••••' },
                  { id: 'signup-confirm', label: 'Confirm password', field: 'confirmPassword' as const, type: 'password', placeholder: '••••••••' },
                ].map(({ id, label, field, type, placeholder }) => (
                  <div key={field}>
                    <label className="label" htmlFor={id}>{label}</label>
                    <input
                      id={id}
                      type={type}
                      placeholder={placeholder}
                      className="input-base"
                      {...signUpForm.register(field)}
                    />
                    {signUpForm.formState.errors[field] && (
                      <p className="text-red-400 text-xs mt-1">{signUpForm.formState.errors[field]?.message}</p>
                    )}
                  </div>
                ))}
                <button
                  id="signup-submit"
                  type="submit"
                  disabled={signUpForm.formState.isSubmitting}
                  className="btn-primary w-full"
                >
                  {signUpForm.formState.isSubmitting ? 'Creating account…' : 'Create Account'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-xs text-zinc-600">or</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Google */}
          <button
            id="google-auth-btn"
            type="button"
            onClick={onGoogleAuth}
            disabled={loadingGoogle}
            className="btn-secondary w-full flex items-center justify-center gap-3"
          >
            {loadingGoogle ? (
              <div className="w-4 h-4 border border-zinc-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
            )}
            Continue with Google
          </button>
        </div>
      </motion.div>

      {/* Password reset modal */}
      <AnimatePresence>
        {showReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={() => setShowReset(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              className="card p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-bold text-zinc-100 mb-4">Reset password</h3>
              <input
                type="email"
                placeholder="your@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="input-base mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setShowReset(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={onResetPassword} className="btn-primary flex-1">Send Reset</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
