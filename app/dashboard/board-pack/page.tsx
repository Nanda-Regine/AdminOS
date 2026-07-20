import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { TopBar } from '@/components/dashboard/TopBar'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { FileBarChart } from 'lucide-react'
import { redirect } from 'next/navigation'
import { PrintButton } from './PrintButton'

// The generator (inngest/functions/boardPack.ts) writes these keys — a mix of
// prose, objects (financials/customers/…), and string arrays (risks/…). The old
// page expected 5 string keys that don't exist, so the pack rendered blank.
type BoardPackData = Record<string, unknown>

type BoardPack = {
  id: string
  tenant_id: string
  month: string
  data: BoardPackData
  generated_at: string
}

const SECTIONS: Array<{ key: string; label: string; icon: string }> = [
  { key: 'executive_summary', label: 'Executive Summary', icon: '📋' },
  { key: 'financial_snapshot', label: 'Financial Snapshot', icon: '💰' },
  { key: 'kpi_highlights',     label: 'KPI Highlights',     icon: '📈' },
  { key: 'customers',          label: 'Customers',          icon: '🤝' },
  { key: 'invoices',           label: 'Invoices & AR',      icon: '🧾' },
  { key: 'staff_summary',      label: 'Team',               icon: '👥' },
  { key: 'compliance_health',  label: 'Compliance',         icon: '🛡️' },
  { key: 'risks_and_issues',   label: 'Risks & Issues',     icon: '⚠️' },
  { key: 'opportunities',      label: 'Opportunities',      icon: '🚀' },
  { key: 'decisions_needed',   label: 'Decisions Needed',   icon: '✅' },
]

// Humanise a snake_case key → "Title Case".
function humanize(k: string): string {
  return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bPct\b/, '%').replace(/\bAr\b/, 'AR')
}

// Format a scalar value; ZAR for money-ish keys, % for *_pct, commas for numbers.
function fmtValue(key: string, v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    if (/_pct$|percentage|rate$/.test(key)) return `${(v <= 1 && v > 0 ? v * 100 : v).toFixed(1)}%`
    if (/revenue|profit|amount|value|overdue|outstanding|expense|cost|cash|total|paid|owed/.test(key))
      return `R ${v.toLocaleString('en-ZA', { maximumFractionDigits: 0 })}`
    return v.toLocaleString('en-ZA')
  }
  return String(v)
}

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

  // Real columns are period_start / pack_data / created_at — aliased so the
  // render (pack.month / pack.data / pack.generated_at) is unchanged.
  const { data: packs } = await supabaseAdmin
    .from('board_packs')
    .select('id, tenant_id, month:period_start, data:pack_data, generated_at:created_at')
    .eq('tenant_id', tenantId)
    .order('period_start', { ascending: false })
    .limit(6)

  const boardPacks = (packs || []) as BoardPack[]
  const latest = boardPacks[0] ?? null

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .maybeSingle()
  const logoUrl = typeof tenant?.settings?.logo_url === 'string' ? tenant.settings.logo_url : null
  const businessName = tenant?.name ?? 'Your Business'

  return (
    <div>
      <TopBar title="Board Pack" subtitle="Monthly governance reports" />
      <div className="p-6 space-y-6">

        {boardPacks.length === 0 ? (
          <Card>
            <EmptyState
              icon={FileBarChart}
              title="No board packs generated yet"
              body="Board packs are auto-generated at month end."
            />
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
                      {idx === 0 && <PrintButton label="Print / PDF" />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Latest pack content — the print-area is isolated for a clean PDF */}
            {latest && (
              <div className="space-y-4 print-area">
                {/* Print-only guard: hide the app chrome so window.print() yields
                    just this branded document. */}
                <style>{`
                  @media print {
                    body * { visibility: hidden !important; }
                    .print-area, .print-area * { visibility: visible !important; }
                    .print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 0 8mm; }
                    .print-hide { display: none !important; }
                    @page { size: A4; margin: 14mm; }
                  }
                `}</style>

                {/* Branded document header — logo + business name (screen + print) */}
                <div className="flex items-center gap-3 pb-4 mb-2" style={{ borderBottom: '2px solid var(--indigo)' }}>
                  {logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoUrl} alt={`${businessName} logo`} style={{ maxHeight: 52, maxWidth: 180, objectFit: 'contain' }} />
                  )}
                  <div>
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{businessName}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Monthly Board Pack — {formatMonth(latest.month)}</p>
                  </div>
                </div>

                {SECTIONS.map(({ key, label, icon }) => {
                  const content = latest.data?.[key]
                  const isEmpty = content === null || content === undefined || content === '' ||
                    (Array.isArray(content) && content.length === 0) ||
                    (typeof content === 'object' && !Array.isArray(content) && Object.keys(content as object).length === 0)
                  if (isEmpty) return null
                  return (
                    <Card key={key}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xl">{icon}</span>
                        <h4 className="font-semibold text-[var(--text-primary)]">{label}</h4>
                      </div>

                      {typeof content === 'string' ? (
                        <div className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap">{content}</div>
                      ) : Array.isArray(content) ? (
                        <ul className="space-y-1.5">
                          {(content as unknown[]).map((item, i) => (
                            <li key={i} className="flex gap-2 text-sm text-[var(--text-secondary)]">
                              <span style={{ color: 'var(--indigo-light)' }}>•</span>
                              <span>{typeof item === 'string' ? item : JSON.stringify(item)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                          {Object.entries(content as Record<string, unknown>).map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between gap-3 border-b py-1.5" style={{ borderColor: 'var(--border)' }}>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{humanize(k)}</span>
                              <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtValue(k, v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  )
                })}

                {/* All sections empty */}
                {SECTIONS.every(({ key }) => {
                  const c = latest.data?.[key]
                  return c === null || c === undefined || c === '' ||
                    (Array.isArray(c) && c.length === 0) ||
                    (typeof c === 'object' && !Array.isArray(c) && Object.keys(c as object).length === 0)
                }) && (
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
