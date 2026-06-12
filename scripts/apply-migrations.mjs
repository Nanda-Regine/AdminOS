import { readFileSync } from 'fs'
import { join, dirname } from 'path'

const TOKEN = process.env.SUPABASE_PAT
const REF   = 'aetydnhnxmrsgqaqtofc'
const URL   = `https://api.supabase.com/v1/projects/${REF}/database/query`

const MIGRATIONS_DIR = 'C:\\Users\\Linda Mona\\OneDrive\\Documents\\AdminOS\\AdminOS\\supabase\\migrations'

const MIGRATIONS = [
  '002_v2_architecture.sql',
  '20260426_rls_audit.sql',
  '20260505_sprint_sage.sql',
  '20260505_sprint_v3.sql',
  '20260612_admins_table.sql',
  '20260612_phase0_ai_cost_controls.sql',
  '20260612_phase0_priority_queue.sql',
  '20260612_phase0_roles_permissions.sql',
  '20260612_phase0_solo_team_mode.sql',
  '20260612_phase1_employee_os.sql',
  '20260612_phase2_health_score.sql',
  '20260612_phase3_academy.sql',
  '20260612_phase3_langa_conversations.sql',
  '20260612_phase3_achievements_seed.sql',
  '20260612_phase3_foundation_content.sql',
  '20260612_phase3_triggers_seed.sql',
  '20260612_phase4_framework_library.sql',
  '20260612_phase4b_framework_library.sql',
  '20260612_phase4c_framework_library.sql',
  '20260612_phase4d_framework_library.sql',
  '20260612_phase5_financial.sql',
  '20260612_phase5_payslip_delivery.sql',
  '20260612_phase6_operations.sql',
  '20260612_phase7_ubuntu.sql',
  '20260612_phase8_compliance.sql',
  '20260612_phase9_11_advanced.sql',
  '20260612_phase10_helpers.sql',
  '20260612_phase11_billing.sql',
  '20260612_phase11_nps_social_webhook.sql',
]

async function applyMigration(filename) {
  const filepath = join(MIGRATIONS_DIR, filename)
  let sql
  try {
    sql = readFileSync(filepath, 'utf8')
  } catch {
    return { file: filename, status: 'MISSING' }
  }

  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })

  const body = await res.text()

  if (res.status === 200 || res.status === 201) {
    return { file: filename, status: 'OK' }
  }

  let msg = body
  try {
    const parsed = JSON.parse(body)
    msg = parsed.message || parsed.error || body
  } catch { /**/ }

  return { file: filename, status: `ERROR ${res.status}`, detail: msg.substring(0, 200) }
}

console.log(`Applying ${MIGRATIONS.length} migrations to project ${REF}...\n`)

for (const m of MIGRATIONS) {
  const result = await applyMigration(m)
  if (result.status === 'OK') {
    console.log(`✓  ${result.file}`)
  } else if (result.status === 'MISSING') {
    console.log(`?  ${result.file} — FILE NOT FOUND`)
  } else {
    console.log(`✗  ${result.file}`)
    console.log(`   ${result.detail}`)
  }
}

console.log('\nDone.')
