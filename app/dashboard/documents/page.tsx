'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Document, Goal } from '@/types/database'

const categoryVariant: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
  strategy: 'blue', invoice: 'green', hr: 'purple', report: 'yellow', contract: 'gray',
}

const fileTypeIcon: Record<string, string> = {
  pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊',
  csv: '📋', pptx: '📑', txt: '📃', md: '📃', rtf: '📃',
  jpg: '🖼️', jpeg: '🖼️', png: '🖼️', webp: '🖼️', gif: '🖼️',
  json: '🗂️', xml: '🗂️',
  mp3: '🎵', m4a: '🎵', wav: '🎵', mp4: '🎬', mov: '🎬',
}

// Accepted file types (mirrors lib/files/parser.ts — update both if adding new types)
const ACCEPTED = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.pptx', '.txt', '.md', '.rtf',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic',
  '.json', '.xml',
  '.mp3', '.m4a', '.wav', '.ogg', '.mp4', '.mov', '.avi',
].join(',')

export default function DocumentsPage() {
  const supabase = createClient()
  const [documents, setDocuments] = useState<Document[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [tenantId, setTenantId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async (tid: string) => {
    const [docsRes, goalsRes] = await Promise.all([
      supabase.from('documents').select('*').eq('tenant_id', tid).order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('tenant_id', tid).eq('status', 'active').order('created_at', { ascending: false }),
    ])
    if (docsRes.data) setDocuments(docsRes.data)
    if (goalsRes.data) setGoals(goalsRes.data)
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const tid = user.user_metadata?.tenant_id
        setTenantId(tid)
        loadData(tid)
      }
    })
  }, [supabase, loadData])

  // Poll for processing documents every 4 seconds
  useEffect(() => {
    if (!tenantId) return
    const hasProcessing = documents.some((d) => d.processing_status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(() => loadData(tenantId), 4000)
    return () => clearInterval(interval)
  }, [tenantId, documents, loadData])

  const uploadFile = async (file: File) => {
    if (!file) return
    setUploading(true)
    setUploadProgress(`Uploading ${file.name}...`)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        setUploadProgress(`Error: ${data.error}`)
        return
      }

      setUploadProgress(
        data.document?.processing_status === 'done'
          ? `Done! ${file.name} processed.`
          : `${file.name} uploaded — AI processing...`
      )
      await loadData(tenantId)
    } catch {
      setUploadProgress('Upload failed. Please try again.')
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(''), 5000)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const getSignedUrl = async (storagePath: string) => {
    const res = await fetch(`/api/documents/upload?path=${encodeURIComponent(storagePath)}`)
    const data = await res.json()
    if (data.url) window.open(data.url, '_blank')
  }

  return (
    <div>
      <TopBar title="Documents" subtitle="Upload, analyse, and track your business files" />
      <div className="p-6 space-y-6">

        {/* Upload zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-emerald-500 bg-emerald-50' : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50/50'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleFileInput}
          />
          <p className="text-3xl mb-3">📎</p>
          <p className="font-semibold text-gray-700 mb-1">
            {uploading ? uploadProgress : 'Drop a file here or click to upload'}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            PDF, Word, Excel, PowerPoint, CSV, Images, Audio, Video · Max 50MB
          </p>
          {uploadProgress && !uploading && (
            <p className="text-sm text-emerald-600 font-medium">{uploadProgress}</p>
          )}
          {!uploading && (
            <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
              Choose file
            </Button>
          )}
          {uploading && (
            <div className="flex items-center justify-center gap-2 text-sm text-emerald-600">
              <span className="animate-spin">⏳</span> Processing...
            </div>
          )}
        </div>

        {/* Supported formats info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '📄', label: 'Documents', types: 'PDF, Word, PowerPoint, RTF' },
            { icon: '📊', label: 'Spreadsheets', types: 'Excel, CSV, Numbers' },
            { icon: '🖼️', label: 'Images', types: 'JPG, PNG, WEBP, HEIC' },
            { icon: '🎵', label: 'Media', types: 'MP3, MP4, WAV, MOV' },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-xl mb-1">{item.icon}</p>
              <p className="text-xs font-semibold text-gray-700">{item.label}</p>
              <p className="text-xs text-gray-400">{item.types}</p>
            </div>
          ))}
        </div>

        {/* Goal tracker */}
        {goals.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Goal Tracker</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => (
                <div key={goal.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-800">{goal.title}</p>
                    <Badge variant={goal.status === 'achieved' ? 'green' : goal.status === 'missed' ? 'red' : 'blue'}>
                      {goal.status}
                    </Badge>
                  </div>
                  {goal.quarter && <p className="text-xs text-gray-400 mb-2">{goal.quarter}</p>}
                  {goal.target_value !== null && (
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{goal.target_metric || 'Progress'}</span>
                        <span>{goal.current_value || 0} / {goal.target_value}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(goal.progress_pct || 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Document list */}
        <Card padding="none">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Uploaded Documents</h3>
            <span className="text-sm text-gray-400">{documents.length} files</span>
          </div>
          <div className="divide-y divide-gray-50">
            {documents.map((doc) => (
              <div key={doc.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{fileTypeIcon[doc.file_type || ''] || '📄'}</span>
                    <div className="min-w-0">
                      <button
                        className="text-sm font-medium text-gray-900 hover:text-emerald-600 truncate text-left"
                        onClick={() => doc.storage_url && getSignedUrl(doc.storage_url)}
                        title={doc.original_filename || ''}
                      >
                        {doc.original_filename}
                      </button>
                      <p className="text-xs text-gray-400">
                        {new Date(doc.created_at).toLocaleDateString('en-ZA')} · {doc.uploaded_by || 'System'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.doc_category && (
                      <Badge variant={categoryVariant[doc.doc_category] || 'gray'}>
                        {doc.doc_category}
                      </Badge>
                    )}
                    <Badge variant={
                      doc.processing_status === 'done' ? 'green' :
                      doc.processing_status === 'failed' ? 'red' : 'yellow'
                    }>
                      {doc.processing_status === 'processing' ? '⏳ processing' : doc.processing_status}
                    </Badge>
                  </div>
                </div>
                {doc.ai_summary && (
                  <p className="mt-2 text-xs text-gray-500 pl-11 leading-relaxed">{doc.ai_summary}</p>
                )}
              </div>
            ))}
            {documents.length === 0 && (
              <div className="px-5 py-12 text-center text-gray-400">
                <p className="text-4xl mb-2">📁</p>
                <p className="text-sm font-medium">No documents yet</p>
                <p className="text-xs mt-1">Upload any file above — AI will classify and extract insights automatically</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
