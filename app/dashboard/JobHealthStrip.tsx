import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import type { JobHealth } from '@/lib/jobs/status'

/**
 * Shown only when a scheduled job has gone quiet or failed — silence when all
 * is well. A job that has stopped running looks exactly like a quiet day, so
 * this is the only place the owner would ever find out their reminders, briefs
 * or alerts weren't going out.
 */
export function JobHealthStrip({ jobs }: { jobs: JobHealth[] }) {
  if (jobs.length === 0) return null
  const names = jobs.map((j) => j.label)
  const shown = names.slice(0, 3).join(', ') + (names.length > 3 ? ` and ${names.length - 3} more` : '')
  return (
    <Link
      href="/dashboard/workflow-monitor"
      className="mt-3 flex items-start gap-2 rounded-xl px-4 py-3 min-h-[44px] text-sm"
      style={{ background: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.3)' }}
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
      <span>
        <strong className="font-semibold">{jobs.length === 1 ? 'An automation hasn’t run on time' : `${jobs.length} automations haven’t run on time`}:</strong>{' '}
        {shown}. Tap to see details.
      </span>
    </Link>
  )
}
