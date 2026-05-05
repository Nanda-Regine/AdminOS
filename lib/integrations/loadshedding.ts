export type LoadSheddingStatus = {
  stage:       number  // 0 = none, 1–8 = stage
  label:       string
  color:       string
  source:      'eskom' | 'fallback'
  fetched_at:  string
}

const STAGE_LABELS = ['No Load Shedding', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Stage 6', 'Stage 7', 'Stage 8']
const STAGE_COLORS = ['#22C55E', '#84CC16', '#EAB308', '#F97316', '#EF4444', '#DC2626', '#B91C1C', '#991B1B', '#7F1D1D']

export async function getLoadSheddingStatus(): Promise<LoadSheddingStatus> {
  try {
    // Eskom free status endpoint — returns integer string (1=no shedding, 2=stage1, ...)
    const res  = await fetch('https://loadshedding.eskom.co.za/LoadShedding/GetStatus', {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5000),
    })
    const text = await res.text()
    const raw  = parseInt(text.trim(), 10)
    // Eskom returns 1 for no load shedding, 2 for stage 1, etc.
    const stage = isNaN(raw) ? 0 : Math.max(0, raw - 1)
    return {
      stage,
      label:      STAGE_LABELS[stage] ?? `Stage ${stage}`,
      color:      STAGE_COLORS[stage] ?? '#EF4444',
      source:     'eskom',
      fetched_at: new Date().toISOString(),
    }
  } catch {
    return {
      stage:      0,
      label:      'Status Unavailable',
      color:      '#475569',
      source:     'fallback',
      fetched_at: new Date().toISOString(),
    }
  }
}
