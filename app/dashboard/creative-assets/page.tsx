'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Clapperboard } from 'lucide-react'
import type { CreativeAsset, CreativeAssetCategory, CreativeAssetStatus } from '@/types/database'

const CATEGORIES: { value: CreativeAssetCategory; label: string; icon: string }[] = [
  { value: 'audio', label: 'Audio', icon: '🎵' },
  { value: 'voice_over', label: 'Voice Over', icon: '🎙️' },
  { value: 'soundtrack', label: 'Soundtrack', icon: '🎼' },
  { value: 'video_long', label: 'Long-Form Video', icon: '🎬' },
  { value: 'video_short', label: 'Short-Form Video', icon: '📱' },
  { value: 'finished_work', label: 'Finished Work', icon: '✅' },
]

const STATUS_VARIANT: Record<CreativeAssetStatus, 'gray' | 'blue' | 'yellow' | 'green'> = {
  draft: 'gray',
  in_review: 'yellow',
  approved: 'blue',
  delivered: 'green',
}

const MAX_HOSTED_BYTES = 100 * 1024 * 1024 // keep in sync with upload-signature/route.ts

type Contact = { id: string; name: string }

export default function CreativeAssetsPage() {
  const supabase = createClient()
  const [assets, setAssets] = useState<CreativeAsset[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filterCategory, setFilterCategory] = useState<CreativeAssetCategory | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [mode, setMode] = useState<'upload' | 'link'>('upload')
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add-asset form state
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<CreativeAssetCategory>('video_short')
  const [contactId, setContactId] = useState('')
  const [notes, setNotes] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [externalProvider, setExternalProvider] = useState('drive')

  const load = useCallback(async () => {
    setLoading(true)
    const qs = filterCategory !== 'all' ? `?category=${filterCategory}` : ''
    const [assetsRes, contactsRes] = await Promise.all([
      fetch(`/api/creative-assets${qs}`).then((r) => r.json()),
      supabase.from('contacts').select('id, name').order('name'),
    ])
    setAssets(assetsRes.assets ?? [])
    setContacts(contactsRes.data ?? [])
    setLoading(false)
  }, [filterCategory, supabase])

  useEffect(() => { load() }, [load])

  const resetForm = () => {
    setTitle(''); setContactId(''); setNotes(''); setExternalUrl(''); setExternalProvider('drive')
    setShowAdd(false); setProgress('')
  }

  const saveExternalLink = async () => {
    if (!title.trim() || !externalUrl.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/creative-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_mode: 'external',
          title: title.trim(),
          category,
          contact_id: contactId || null,
          notes: notes.trim() || null,
          external_url: externalUrl.trim(),
          external_provider: externalProvider,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setProgress(`Error: ${err.error ?? 'Could not save'}`)
        return
      }
      resetForm()
      await load()
    } finally {
      setSaving(false)
    }
  }

  const uploadFile = async (file: File) => {
    if (!title.trim()) {
      setProgress('Give it a title first.')
      return
    }
    if (file.size > MAX_HOSTED_BYTES) {
      setProgress(
        `That's ${(file.size / 1024 / 1024).toFixed(0)}MB — over the ${MAX_HOSTED_BYTES / 1024 / 1024}MB direct-upload limit. ` +
        `Use "Link instead" for large files (upload it to Drive/Dropbox/Frame.io first, then paste the link here).`
      )
      return
    }

    setSaving(true)
    setProgress(`Uploading ${file.name}...`)
    try {
      const resourceType = file.type.startsWith('image/') ? 'image' : 'video'
      const sigRes = await fetch('/api/creative-assets/upload-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType }),
      })
      if (!sigRes.ok) {
        const err = await sigRes.json().catch(() => ({}))
        setProgress(`Error: ${err.error ?? 'Could not start upload'}`)
        return
      }
      const sig = await sigRes.json()

      const form = new FormData()
      form.append('file', file)
      form.append('api_key', sig.apiKey)
      form.append('timestamp', String(sig.timestamp))
      form.append('signature', sig.signature)
      form.append('folder', sig.folder)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`,
        { method: 'POST', body: form }
      )
      const uploaded = await uploadRes.json()
      if (!uploadRes.ok) {
        setProgress(`Upload failed: ${uploaded.error?.message ?? 'unknown error'}`)
        return
      }

      const saveRes = await fetch('/api/creative-assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storage_mode: 'hosted',
          title: title.trim(),
          category,
          contact_id: contactId || null,
          notes: notes.trim() || null,
          cloudinary_public_id: uploaded.public_id,
          cloudinary_url: uploaded.secure_url,
          cloudinary_resource_type: uploaded.resource_type,
          file_size_bytes: uploaded.bytes,
        }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        setProgress(`Uploaded, but couldn't save the record: ${err.error ?? 'unknown error'}`)
        return
      }

      resetForm()
      await load()
    } catch {
      setProgress('Upload failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id: string, status: CreativeAssetStatus) => {
    await fetch(`/api/creative-assets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  const removeAsset = async (id: string) => {
    await fetch(`/api/creative-assets/${id}`, { method: 'DELETE' })
    await load()
  }

  const openAsset = (asset: CreativeAsset) => {
    const url = asset.storage_mode === 'hosted' ? asset.cloudinary_url : asset.external_url
    if (url) window.open(url, '_blank')
  }

  const formatSize = (bytes: number | null) => {
    if (!bytes) return ''
    const mb = bytes / 1024 / 1024
    return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(0)}KB`
  }

  return (
    <div>
      <TopBar title="Creative Assets" subtitle="Track your audio, video, and finished deliverables" />
      <div className="p-6 space-y-6">

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterCategory === 'all' ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setFilterCategory(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterCategory === c.value ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        {/* Add asset */}
        <Card>
          {!showAdd ? (
            <Button onClick={() => setShowAdd(true)}>+ Add asset</Button>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('upload')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'upload' ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}
                >
                  Upload file
                </button>
                <button
                  onClick={() => setMode('link')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${mode === 'link' ? 'bg-emerald-500 text-white' : 'bg-[var(--surface-2)] text-[var(--text-secondary)]'}`}
                >
                  Link instead
                </button>
                <span className="text-xs text-[var(--text-dim)] ml-1">
                  {mode === 'upload' ? `Direct upload, max ${MAX_HOSTED_BYTES / 1024 / 1024}MB` : 'For anything larger, or already hosted elsewhere'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-1)]"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CreativeAssetCategory)}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-1)]"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                  ))}
                </select>
                <select
                  value={contactId}
                  onChange={(e) => setContactId(e.target.value)}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-1)]"
                >
                  <option value="">No client linked</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-1)]"
                />
              </div>

              {mode === 'upload' ? (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) uploadFile(file)
                      e.target.value = ''
                    }}
                  />
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={saving}>
                    {saving ? 'Uploading…' : 'Choose file'}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-1)]"
                  />
                  <select
                    value={externalProvider}
                    onChange={(e) => setExternalProvider(e.target.value)}
                    className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm bg-[var(--surface-1)]"
                  >
                    <option value="drive">Google Drive</option>
                    <option value="dropbox">Dropbox</option>
                    <option value="frameio">Frame.io</option>
                    <option value="vimeo">Vimeo</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}

              {progress && <p className="text-sm text-[var(--text-muted)]">{progress}</p>}

              <div className="flex gap-2">
                {mode === 'link' && (
                  <Button onClick={saveExternalLink} disabled={saving || !title.trim() || !externalUrl.trim()}>
                    Save
                  </Button>
                )}
                <Button variant="secondary" onClick={resetForm} disabled={saving}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>

        {/* Asset list */}
        <Card padding="none">
          <div className="p-5 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text-primary)]">Assets</h3>
            <span className="text-sm text-[var(--text-dim)]">{assets.length} item{assets.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {!loading && assets.map((asset) => {
              const cat = CATEGORIES.find((c) => c.value === asset.category)
              const contact = contacts.find((c) => c.id === asset.contact_id)
              return (
                <div key={asset.id} className="px-5 py-4 hover:bg-[var(--surface-hover)] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0">{cat?.icon ?? '🎬'}</span>
                      <div className="min-w-0">
                        <button
                          className="text-sm font-medium text-[var(--text-primary)] hover:text-emerald-600 truncate text-left"
                          onClick={() => openAsset(asset)}
                          title={asset.title}
                        >
                          {asset.title}
                        </button>
                        <p className="text-xs text-[var(--text-dim)]">
                          {cat?.label}{contact ? ` · ${contact.name}` : ''}
                          {asset.storage_mode === 'hosted' && asset.file_size_bytes ? ` · ${formatSize(asset.file_size_bytes)}` : ''}
                          {asset.storage_mode === 'external' ? ` · linked (${asset.external_provider})` : ''}
                          {' · '}{new Date(asset.created_at).toLocaleDateString('en-ZA')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={asset.status}
                        onChange={(e) => updateStatus(asset.id, e.target.value as CreativeAssetStatus)}
                        className="text-xs border border-[var(--border)] rounded-md px-2 py-1 bg-[var(--surface-1)]"
                      >
                        <option value="draft">Draft</option>
                        <option value="in_review">In review</option>
                        <option value="approved">Approved</option>
                        <option value="delivered">Delivered</option>
                      </select>
                      <Badge variant={STATUS_VARIANT[asset.status]}>{asset.status.replace('_', ' ')}</Badge>
                      <button
                        onClick={() => removeAsset(asset.id)}
                        className="text-xs text-[var(--text-dim)] hover:text-red-500"
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {asset.notes && (
                    <p className="mt-2 text-xs text-[var(--text-muted)] pl-11 leading-relaxed">{asset.notes}</p>
                  )}
                </div>
              )
            })}
            {!loading && assets.length === 0 && (
              <EmptyState
                icon={Clapperboard}
                title="No creative assets yet"
                body="Upload a file directly, or link one you've already got hosted elsewhere."
                action={{ label: 'Add an asset', onClick: () => setShowAdd(true) }}
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
