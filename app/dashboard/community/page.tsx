'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'

type Post = {
  id: string
  tenant_id: string | null
  category: string
  title: string
  body: string
  anonymous: boolean
  sector: string | null
  province: string | null
  replies_count: number
  helpful_count: number
  created_at: string
}

const CATEGORIES: { key: string; label: string; color: string; emoji: string }[] = [
  { key: 'all',            label: 'All',            color: 'bg-[var(--surface-2)] text-[var(--text-secondary)]',       emoji: '🗂' },
  { key: 'need_help',      label: 'Need Help',      color: 'bg-violet-100 text-violet-700',   emoji: '🙋' },
  { key: 'can_help',       label: 'Can Help',       color: 'bg-blue-100 text-blue-700',       emoji: '🤝' },
  { key: 'experience',     label: 'Experience',     color: 'bg-indigo-100 text-indigo-700',   emoji: '💡' },
  { key: 'supplier_review',label: 'Supplier Review',color: 'bg-orange-100 text-orange-700',   emoji: '⭐' },
  { key: 'celebration',    label: 'Celebration',    color: 'bg-yellow-100 text-yellow-700',   emoji: '🏆' },
]

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)   return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60)   return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)   return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)    return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
}

function catMeta(key: string) {
  return CATEGORIES.find(c => c.key === key) ?? { label: key, color: 'bg-[var(--surface-2)] text-[var(--text-secondary)]', emoji: '💬' }
}

export default function CommunityPage() {
  const [posts, setPosts]           = useState<Post[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState('all')
  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [category, setCategory]     = useState('need_help')
  const [anonymous, setAnonymous]   = useState(false)
  const [posting, setPosting]       = useState(false)
  const [postError, setPostError]   = useState<string | null>(null)
  const [showForm, setShowForm]     = useState(false)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/community?limit=30')
      if (res.ok) setPosts(await res.json() as Post[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts() }, [fetchPosts])

  async function submitPost(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || posting) return
    setPosting(true)
    setPostError(null)
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), category, anonymous }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? 'Failed to post')
      }
      setTitle('')
      setBody('')
      setShowForm(false)
      await fetchPosts()
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPosting(false)
    }
  }

  const filtered = filter === 'all' ? posts : posts.filter(p => p.category === filter)

  return (
    <div>
      <TopBar title="Community" subtitle="Peer network — learn, share, grow together" />
      <div className="p-6 space-y-5 max-w-3xl mx-auto">

        {/* Action bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => setFilter(c.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === c.key
                    ? `${c.color} ring-2 ring-offset-1 ring-current`
                    : `${c.color} opacity-60 hover:opacity-100`
                }`}
              >
                <span>{c.emoji}</span>
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowForm(v => !v)}
            className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 active:scale-95 transition-all"
          >
            {showForm ? 'Cancel' : '+ Post'}
          </button>
        </div>

        {/* Compose form */}
        {showForm && (
          <Card>
            <form onSubmit={submitPost} className="space-y-3">
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Post title (e.g. 'Looking for a reliable Cape Town accountant')"
                className="w-full text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-[var(--text-dim)]"
              />
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Share the detail — the more context you give, the better the responses…"
                rows={4}
                className="w-full resize-none text-sm rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-[var(--text-dim)]"
              />
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="text-xs border border-[var(--border)] rounded-lg px-3 py-2 bg-[var(--surface-1)] text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                    <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={anonymous}
                    onChange={e => setAnonymous(e.target.checked)}
                    className="rounded"
                  />
                  Post anonymously
                </label>
                <button
                  type="submit"
                  disabled={!title.trim() || !body.trim() || posting}
                  className="ml-auto px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {posting ? 'Posting…' : 'Post to community'}
                </button>
              </div>
              {postError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{postError}</p>
              )}
            </form>
          </Card>
        )}

        {/* Post feed */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 rounded-2xl bg-[var(--surface-2)] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <div className="text-center py-14">
              <p className="text-4xl mb-3">🌱</p>
              <p className="text-sm font-medium text-[var(--text-muted)]">
                {filter === 'all' ? 'The community board is quiet' : `No ${catMeta(filter).label} posts yet`}
              </p>
              <p className="text-xs text-[var(--text-dim)] mt-1">Be the first to share something.</p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map(post => {
              const meta = catMeta(post.category)
              return (
                <Card key={post.id}>
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0 font-medium ${meta.color}`}>
                      {meta.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${meta.color}`}>
                          {meta.label}
                        </span>
                        {post.anonymous && (
                          <span className="text-xs text-[var(--text-dim)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">anonymous</span>
                        )}
                        <span className="text-xs text-[var(--text-dim)] ml-auto shrink-0">{timeAgo(post.created_at)}</span>
                      </div>

                      <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{post.title}</p>
                      <p className="text-sm text-[var(--text-muted)] mt-0.5 leading-relaxed">
                        {post.body.length > 220 ? post.body.slice(0, 220).trimEnd() + '…' : post.body}
                      </p>

                      <div className="flex items-center gap-5 mt-3 text-xs text-[var(--text-dim)]">
                        <span className="flex items-center gap-1.5">
                          <span>👍</span>
                          <span>{post.helpful_count} helpful</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span>💬</span>
                          <span>{post.replies_count} {post.replies_count === 1 ? 'reply' : 'replies'}</span>
                        </span>
                        {post.sector && (
                          <span className="text-[var(--text-dim)]">· {post.sector}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
