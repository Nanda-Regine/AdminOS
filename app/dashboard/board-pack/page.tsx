import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { redirect } from 'next/navigation'

type BoardPackData = {
  executive_summary?: string
  financial_summary?: string
  team_update?: string
  key_decisions?: string
  risks?: string
}

type BoardPack = {
  id: string
  tenant_id: string
  month: string
  data: BoardPackData
  generated_at: string
}

const SECTIONS: Array<{ key: keyof BoardPackData; label: string; icon: string }> = [
  { key: 'executive_summary', label: 'Executive Summary', icon: '📋' },
  { key: 'financial_summary', label: 'Financial Summary', icon: '💰' },
  { key: 'team_update', label: 'Team Update', icon: '👥' },
  { key: 'key_decisions', label: 'Key Decisions', icon: '✅' },
  { key: 'risks', label: 'Risks & Mitigations', icon: '⚠️' },
]

function formatMonth(month: string): string {
  // month expected as YYYY-MM
  const [year, mon] = month.split('-')
  const d = new Date(Number(year), Number(mon) - 1, 1)
  return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function BoardPackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tenantId = user.app_metadata?.tenant_id as string

  const { data: packs } = await supabaseAdmin
    .from('board_packs')
    .select('id, tenant_id, month, data, generated_at')
    .eq('tenant_id', tenantId)
    .order('month', { ascending: false })
    .limit(6)

  const boardPacks = (packs || []) as BoardPack[]
  const latest = boardPacks[0] ?? null

  return (
    <div>
      <TopBar title="Board Pack" subtitle="Monthly governance reports" />
      <div className="p-6 space-y-6">

        {boardPacks.length === 0 ? (
          <Card>
            <div className="text-center py-14 text-[var(--text-dim)]">
              <p className="text-4xl mb-3">📁</p>
              <p className="text-sm font-medium text-[var(--text-muted)] mb-1">No board packs generated yet</p>
              <p className="text-xs">Board packs are auto-generated at month end.</p>
            </div>
          </Card>
        ) : (
          <>
            {/* Pack list */}
            <Card>
              <h3 className="font-semibold text-[var(--text-primary)] mb-4">Generated Packs</h3>
              <div className="space-y-2">
                {boardPacks.map((pack, idx) => (
                  <div
                    key={pack.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      idx === 0
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-[var(--surface-2)] border-[var(--border)] hover:bg-[var(--surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📋</span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {formatMonth(pack.month)}
                        </p>
                        <p className="text-xs text-[var(--text-dim)]">
                          Generated {formatDateTime(pack.generated_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Badge variant="green">Latest</Badge>}
                      {/* Download placeholder — will wire to PDF export */}
                      <button
                        disabled
                        className="text-xs text-[var(--text-dim)] border border-[var(--border)] px-3 py-1.5 rounded-lg cursor-not-allowed"
                        title="PDF download coming soon"
                      >
                        Download PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Latest pack content */}
            {latest && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text-secondary)]">
                    Viewing: {formatMonth(latest.month)}
                  </h3>
                </div>

                {SECTIONS.map(({ key, label, icon }) => {
                  const content = latest.data?.[key]
                  if (!content) return null
                  return (
                    <Card key={key}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{icon}</span>
                        <h4 className="font-semibold text-[var(--text-primary)]">{label}</h4>
                      </div>
                      <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">
                        {content}
                      </div>
                    </Card>
                  )
                })}

                {/* Check if all sections are empty */}
                {SECTIONS.every(({ key }) => !latest.data?.[key]) && (
                  <Card>
                    <p className="text-sm text-[var(--text-dim)] text-center py-6">
                      This board pack has no content sections.
                    </p>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
