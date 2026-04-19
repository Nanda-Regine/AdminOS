import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { redirect } from 'next/navigation'
import { CheckCircle2, Clock, XCircle, Zap, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-amber-500 bg-amber-50', label: 'Pending' },
  processing: { icon: RefreshCw, color: 'text-blue-500 bg-blue-50', label: 'Processing' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500 bg-red-50', label: 'Failed' },
}

export default async function WorkflowMonitorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.user_metadata?.tenant_id as string

  const [queueResult, auditResult, convResult] = await Promise.all([
    supabaseAdmin
      .from('workflow_queue')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabaseAdmin
      .from('audit_logs')
      .select('id, action, resource_type, resource_id, created_at, metadata')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabaseAdmin
      .from('conversations')
      .select('id, contact_name, status, intent, escalation_level, updated_at')
      .eq('tenant_id', tenantId)
      .gt('escalation_level', 0)
      .order('escalation_level', { ascending: false })
      .limit(10),
  ])

  const queue = queueResult.data || []
  const auditLogs = auditResult.data || []
  const escalated = convResult.data || []

  const counts = {
    pending: queue.filter((j) => j.status === 'pending').length,
    processing: queue.filter((j) => j.status === 'processing').length,
    completed: queue.filter((j) => j.status === 'completed').length,
    failed: queue.filter((j) => j.status === 'failed').length,
  }

  return (
    <div>
      <TopBar title="Workflow Monitor" subtitle="Real-time automation pipeline status" />

      <div className="p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {(Object.entries(counts) as [keyof typeof counts, number][]).map(([status, count]) => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            return (
              <div key={status} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="text-xs text-gray-500 mt-1">{cfg.label}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Workflow queue */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="font-semibold text-gray-900 text-sm">Workflow Queue</h3>
              <span className="ml-auto text-xs text-gray-400">{queue.length} jobs</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {queue.map((job) => {
                const status = (job.status || 'pending') as keyof typeof STATUS_CONFIG
                const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
                const Icon = cfg.icon
                return (
                  <div key={job.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate capitalize">
                        {(job.workflow_type || 'workflow').replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(job.created_at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                )
              })}
              {queue.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  No workflows in queue. Workflows run automatically from document uploads, escalations, and debt recovery.
                </div>
              )}
            </div>
          </div>

          {/* Audit log */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Audit Log</h3>
              <span className="ml-auto text-xs text-gray-400">Last 30 events</span>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 font-mono text-xs">{log.action}</p>
                    <p className="text-xs text-gray-400 capitalize">{log.resource_type} · {log.resource_id?.slice(0, 8)}...</p>
                  </div>
                  <span className="text-xs text-gray-300 shrink-0">
                    {new Date(log.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">
                  Audit events will appear here as agents take actions.
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Escalated conversations */}
        {escalated.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Escalated Conversations</h3>
              </div>
              <Link href="/dashboard/inbox" className="text-xs text-[#2D4A22] font-medium hover:underline">View inbox</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {escalated.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/dashboard/inbox?id=${conv.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-semibold text-sm shrink-0">
                    {(conv.contact_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{conv.contact_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 capitalize">{conv.intent || 'general'} · Level {conv.escalation_level}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(conv.updated_at).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
