import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { db } from '../lib/firebase'
import { useAuthStore } from '../store/authStore'
import { searchUsers, sendFriendRequest, acceptFriendRequest } from '../lib/functions'
import { toast } from '../store/toastStore'
import { Navbar } from '../components/Navbar'
import type { FriendDoc, UserStub } from '../types'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function FriendsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebounce(searchQuery, 400)
  const [searchResults, setSearchResults] = useState<UserStub[]>([])
  const [searching, setSearching] = useState(false)
  const [sendingTo, setSendingTo] = useState<string | null>(null)

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends', user?.uid],
    queryFn: async () => {
      const snap = await getDocs(collection(db, 'users', user!.uid, 'friends'))
      return snap.docs.map((d) => d.data() as FriendDoc)
    },
    enabled: !!user,
    staleTime: 0,
  })

  const accepted = friends.filter((f) => f.status === 'accepted')
  const pending = friends.filter((f) => f.status === 'pending' && f.initiatedBy !== user?.uid)

  useEffect(() => {
    if (!debouncedQuery.trim()) { setSearchResults([]); return }
    setSearching(true)
    searchUsers({ query: debouncedQuery })
      .then((res) => setSearchResults(res.data.users.filter((u) => u.uid !== user?.uid)))
      .catch(() => setSearchResults([]))
      .finally(() => setSearching(false))
  }, [debouncedQuery, user?.uid])

  const handleSendRequest = async (targetUid: string) => {
    setSendingTo(targetUid)
    try {
      await sendFriendRequest({ targetUid })
      toast.success('Friend request sent!')
      qc.invalidateQueries({ queryKey: ['friends', user?.uid] })
    } catch {
      toast.error('Failed to send request')
    } finally {
      setSendingTo(null)
    }
  }

  const handleAccept = async (requesterUid: string) => {
    try {
      await acceptFriendRequest({ requesterUid })
      toast.success('Friend accepted!')
      qc.invalidateQueries({ queryKey: ['friends', user?.uid] })
    } catch { toast.error('Failed to accept') }
  }

  const handleDecline = async (requesterUid: string) => {
    try {
      await deleteDoc(doc(db, 'users', user!.uid, 'friends', requesterUid))
      await deleteDoc(doc(db, 'users', requesterUid, 'friends', user!.uid))
      qc.invalidateQueries({ queryKey: ['friends', user?.uid] })
    } catch { toast.error('Failed to decline') }
  }

  const sentUids = new Set(friends.filter((f) => f.initiatedBy === user?.uid).map((f) => f.friendUid))
  const friendUids = new Set(accepted.map((f) => f.friendUid))

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navbar />
      <main className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8 space-y-10">
        <h1 className="text-2xl font-bold text-zinc-100">Friends</h1>

        <section>
          <h2 className="section-header mb-4">Find Friends</h2>
          <div className="relative mb-4">
            <input id="friend-search" type="text" placeholder="Search by username…"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input-base" />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="card divide-y divide-zinc-800">
                {searchResults.map((u) => {
                  const isFriend = friendUids.has(u.uid)
                  const isPending = sentUids.has(u.uid)
                  return (
                    <div key={u.uid} className="flex items-center gap-3 p-3">
                      <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden">
                        {u.photoUrl ? <img src={u.photoUrl} alt="" className="w-full h-full object-cover" /> : u.displayName[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-200 truncate">{u.displayName}</p>
                        <p className="text-xs text-zinc-500">@{u.username}</p>
                      </div>
                      {isFriend ? <span className="text-xs text-green-400">Friends ✓</span>
                       : isPending ? <span className="text-xs text-zinc-500">Requested</span>
                       : <button onClick={() => handleSendRequest(u.uid)} disabled={sendingTo === u.uid} className="btn-primary text-xs px-3 py-1.5">
                           {sendingTo === u.uid ? '…' : 'Add friend'}
                         </button>}
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {pending.length > 0 && (
          <section>
            <h2 className="section-header mb-4">Pending Requests <span className="text-violet-400">({pending.length})</span></h2>
            <div className="card divide-y divide-zinc-800">
              {pending.map((req) => (
                <div key={req.friendUid} className="flex items-center gap-3 p-3">
                  <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center text-zinc-400 text-sm flex-shrink-0">?</div>
                  <div className="flex-1"><p className="text-sm text-zinc-300">{req.friendUid}</p><p className="text-xs text-zinc-500">Wants to be friends</p></div>
                  <button onClick={() => handleAccept(req.friendUid)} className="btn-primary text-xs px-3 py-1.5">Accept</button>
                  <button onClick={() => handleDecline(req.friendUid)} className="btn-secondary text-xs px-3 py-1.5">Decline</button>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="section-header mb-4">Your Friends ({accepted.length})</h2>
          {friendsLoading ? <div className="card p-6 text-center text-zinc-500">Loading…</div>
           : accepted.length === 0 ? (
            <div className="card p-8 text-center text-zinc-500">
              <p className="text-3xl mb-3">⊕</p><p>No friends yet — search above to connect!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accepted.map((f) => (
                <div key={f.friendUid} className="card p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {f.friendUid[0].toUpperCase()}
                  </div>
                  <div><p className="text-sm font-medium text-zinc-200">@{f.friendUid}</p>
                    <p className="text-xs text-zinc-500">Friends since {f.createdAt?.toDate?.()?.toLocaleDateString()}</p></div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
