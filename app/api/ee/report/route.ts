import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { checkPermission } from '@/lib/auth/permissions'

// GET /api/ee/report?year=2026
// Returns a printable EEA2-style Employment Equity report (HTML, print-to-PDF)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  if (!(await checkPermission('manage_settings'))) return new NextResponse('Forbidden', { status: 403 })

  const url  = new URL(request.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))

  // Fetch EE data for this year
  const { data: eeData } = await supabaseAdmin
    .from('employment_equity')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('reporting_year', year)
    .single()

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('name, settings')
    .eq('id', tenantId)
    .single()

  const settings = tenant?.settings as Record<string, string> | null

  // Fetch current headcount breakdown from staff
  const { data: staff } = await supabaseAdmin
    .from('staff')
    .select('gender, race, job_level, employment_type')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')

  // Aggregate staff by occupational level, race, and gender
  const occupationalLevels = [
    'Top Management',
    'Senior Management',
    'Professionally Qualified',
    'Skilled Technical',
    'Semi-Skilled',
    'Unskilled',
  ]

  const raceGroups = ['African', 'Coloured', 'Indian', 'White', 'Foreign National']
  const genders    = ['Male', 'Female']

  interface CellData { male: number; female: number; total: number }
  interface LevelData { [race: string]: CellData }
  interface TableData { [level: string]: LevelData }

  const tableData: TableData = {}

  for (const level of occupationalLevels) {
    tableData[level] = {}
    for (const race of raceGroups) {
      tableData[level][race] = { male: 0, female: 0, total: 0 }
    }
    tableData[level]['Total'] = { male: 0, female: 0, total: 0 }
  }

  for (const person of staff ?? []) {
    const level = normaliseLevel(person.job_level)
    const race  = normaliseRace(person.race)
    const gender = (person.gender ?? '').toLowerCase()

    if (!level || !race) continue
    if (!tableData[level]) continue

    const isM = gender === 'male'
    const isF = gender === 'female'

    if (tableData[level][race]) {
      if (isM) tableData[level][race].male++
      if (isF) tableData[level][race].female++
      tableData[level][race].total++
    }

    if (isM) tableData[level]['Total'].male++
    if (isF) tableData[level]['Total'].female++
    tableData[level]['Total'].total++
  }

  const totalStaff  = (staff ?? []).length
  const totalAfrican = (staff ?? []).filter(s => normaliseRace(s.race) === 'African').length
  const totalColoured = (staff ?? []).filter(s => normaliseRace(s.race) === 'Coloured').length
  const totalIndian  = (staff ?? []).filter(s => normaliseRace(s.race) === 'Indian').length
  const totalWhite   = (staff ?? []).filter(s => normaliseRace(s.race) === 'White').length
  const totalFemale  = (staff ?? []).filter(s => (s.gender ?? '').toLowerCase() === 'female').length

  const eeTarget = eeData?.ee_target_pct ?? null

  const tableRows = occupationalLevels.map(level => {
    const r = tableData[level]
    const cols = [...raceGroups, 'Total'].map(race => {
      const d = r[race] ?? { male: 0, female: 0, total: 0 }
      return `<td>${d.male}</td><td>${d.female}</td><td>${d.total}</td>`
    }).join('')
    return `<tr><td class="level">${esc(level)}</td>${cols}</tr>`
  })

  const pwdRows = `<tr>
    <td colspan="2">People with Disabilities</td>
    <td colspan="3">${eeData?.total_pwd ?? 0}</td>
    <td colspan="15">—</td>
  </tr>`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>EEA2 Employment Equity Report — ${esc(String(year))}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #111; padding: 20px; }
  .page { max-width: 1000px; margin: 0 auto; }
  h1 { font-size: 14px; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 11px; margin: 12px 0 4px; border-bottom: 1px solid #333; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }
  .info-item { border: 1px solid #ccc; padding: 4px 6px; }
  .info-item .label { font-size: 8px; color: #777; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #999; padding: 3px 4px; text-align: center; }
  th { background: #1a56db; color: #fff; font-size: 8px; }
  td.level { text-align: left; font-weight: bold; font-size: 9px; }
  .section-header { background: #e8f0ff; font-weight: bold; }
  .summary-box { display: inline-block; border: 1px solid #ccc; padding: 8px 16px; margin: 4px; text-align: center; }
  .summary-box .val { font-size: 20px; font-weight: bold; color: #1a56db; }
  .footer { text-align: center; margin-top: 20px; font-size: 8px; color: #aaa; }
  @media print { body { padding: 0; } @page { size: A3 landscape; margin: 15mm; } }
</style>
</head>
<body>
<div class="page">
  <h1>EMPLOYMENT EQUITY REPORT (EEA2)</h1>
  <p style="text-align:center;font-size:10px;margin-bottom:12px;">Reporting Year: <strong>${esc(String(year))}</strong> | ${esc(tenant?.name ?? 'Company')}</p>

  <div class="info-grid">
    <div class="info-item"><div class="label">Company Name</div>${esc(tenant?.name ?? '')}</div>
    <div class="info-item"><div class="label">Registration Number</div>${esc(settings?.registration_number ?? 'N/A')}</div>
    <div class="info-item"><div class="label">EE Target (%)</div>${eeTarget !== null ? eeTarget + '%' : 'Not set'}</div>
    <div class="info-item"><div class="label">Total Employees</div>${totalStaff}</div>
  </div>

  <div style="margin-bottom:12px;">
    <div class="summary-box"><div class="val">${totalAfrican}</div><div>African</div></div>
    <div class="summary-box"><div class="val">${totalColoured}</div><div>Coloured</div></div>
    <div class="summary-box"><div class="val">${totalIndian}</div><div>Indian/Asian</div></div>
    <div class="summary-box"><div class="val">${totalWhite}</div><div>White</div></div>
    <div class="summary-box"><div class="val">${totalFemale}</div><div>Female</div></div>
    <div class="summary-box"><div class="val">${eeData?.total_pwd ?? 0}</div><div>PWD</div></div>
  </div>

  <h2>Workforce Profile by Occupational Level (EEA2 Form A)</h2>
  <table>
    <thead>
      <tr>
        <th rowspan="2">Occupational Level</th>
        <th colspan="3">African</th>
        <th colspan="3">Coloured</th>
        <th colspan="3">Indian</th>
        <th colspan="3">White</th>
        <th colspan="3">Foreign National</th>
        <th colspan="3">Total</th>
      </tr>
      <tr>
        ${[...raceGroups, 'Total'].map(() => '<th>M</th><th>F</th><th>T</th>').join('')}
      </tr>
    </thead>
    <tbody>
      ${tableRows.join('')}
      ${pwdRows}
    </tbody>
  </table>

  ${eeData?.goals ? `
  <h2>EE Goals & Targets</h2>
  <table>
    <thead><tr><th>Goal</th><th>Target Date</th><th>Progress</th></tr></thead>
    <tbody>
    ${(eeData.goals as Array<{goal: string; target_date: string; progress_notes: string}>)
      .map(g => `<tr><td style="text-align:left">${esc(g.goal ?? '')}</td><td>${esc(g.target_date ?? '')}</td><td>${esc(g.progress_notes ?? '')}</td></tr>`)
      .join('')}
    </tbody>
  </table>
  ` : ''}

  <p style="margin-top:12px;font-size:9px;">
    <strong>Note:</strong> This report is generated for internal tracking purposes. The official EEA2 submission must be made via the Department of Employment and Labour''s online system (www.dee.gov.za). Data accuracy is the responsibility of the employer.
  </p>

  <div class="footer">Generated by AdminOS — ${esc(tenant?.name ?? '')} — ${new Date().toLocaleDateString('en-ZA')}</div>
</div>
</body>
</html>`

  const download = url.searchParams.get('download') === 'true'
  const headers: Record<string, string> = {
    'Content-Type':  'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
  }

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="EEA2-${year}-${tenant?.name?.replace(/\s+/g, '-') ?? 'report'}.html"`
  }

  return new NextResponse(html, { headers })
}

function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function normaliseLevel(raw: string | null): string | null {
  if (!raw) return null
  const r = raw.toLowerCase()
  if (r.includes('top') || r.includes('executive') || r.includes('director')) return 'Top Management'
  if (r.includes('senior') || r.includes('general manager')) return 'Senior Management'
  if (r.includes('professional') || r.includes('qualified') || r.includes('manager')) return 'Professionally Qualified'
  if (r.includes('skilled') || r.includes('technical') || r.includes('supervisor')) return 'Skilled Technical'
  if (r.includes('semi')) return 'Semi-Skilled'
  if (r.includes('unskilled') || r.includes('labourer') || r.includes('cleaner')) return 'Unskilled'
  return 'Semi-Skilled'
}

function normaliseRace(raw: string | null): string | null {
  if (!raw) return null
  const r = raw.toLowerCase()
  if (r.includes('african') || r.includes('black')) return 'African'
  if (r.includes('coloured')) return 'Coloured'
  if (r.includes('indian') || r.includes('asian')) return 'Indian'
  if (r.includes('white')) return 'White'
  if (r.includes('foreign') || r.includes('international')) return 'Foreign National'
  return null
}
