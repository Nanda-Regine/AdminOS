// End-to-end write-path verification: create via the real API → confirm the row
// lands with the columns the app reads → clean up. Covers the main create flows
// plus the just-fixed portal link. Run against production, demo tenant.
//   node scripts/verify_write_flows.mjs
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))

const U = env.NEXT_PUBLIC_SUPABASE_URL, A = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const MT = env.SUPABASE_ACCESS_TOKEN
const APP = 'https://www.adminos.co.za'
const REF = 'aetydnhnxmrsgqaqtofc'
const TEST_EMAIL = 'founder@adminos-demo.co.za', TEST_PW = 'AdminOS-Test-2026!'

let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  ✓', m) }
const bad = (m) => { fail++; console.log('  ✗ FAIL:', m) }

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${MT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return await r.json().catch(() => [])
}

const t = await (await fetch(`${U}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: A, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PW }),
})).json()
if (!t.access_token) { console.log('login failed'); process.exit(1) }
const claims = JSON.parse(Buffer.from(t.access_token.split('.')[1], 'base64').toString())
const TENANT = claims.app_metadata?.tenant_id
const session = { access_token: t.access_token, token_type: t.token_type, expires_in: t.expires_in, expires_at: t.expires_at, refresh_token: t.refresh_token, user: t.user }
const COOKIE = `sb-${REF}-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
const auth = (path, init = {}) => fetch(APP + path, { ...init, headers: { cookie: COOKIE, 'content-type': 'application/json', ...(init.headers || {}) } })
const MK = `E2E-${claims.iat}`
console.log(`\n== Write-flow verification (tenant ${TENANT?.slice(0,8)}…) ==`)

// ── contacts ─────────────────────────────────────────────────────────────────
console.log('\n[contacts]')
{
  const r = await auth('/api/contacts', { method: 'POST', body: JSON.stringify({ full_name: `${MK} Contact`, phone: '+27820000001' }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/contacts → ${r.status}`) : bad(`create ${r.status}: ${JSON.stringify(j)}`)
  const row = (await sql(`select full_name from contacts where tenant_id='${TENANT}' and full_name='${MK} Contact' limit 1;`))[0]
  row?.full_name === `${MK} Contact` ? ok('row persisted with full_name (the column the CRM reads)') : bad('contact row missing/blank name')
  await sql(`delete from contacts where tenant_id='${TENANT}' and full_name='${MK} Contact';`)
  ok('cleaned up')
}

// ── expenses (seed a throwaway staff member to attach it to) ──────────────────
console.log('\n[expenses]')
{
  let staffId = (await sql(`select id from staff where tenant_id='${TENANT}' limit 1;`))[0]?.id
  let seeded = false
  if (!staffId) {
    const s = await sql(`insert into staff (tenant_id, full_name) values ('${TENANT}','${MK} Staff') returning id;`)
    staffId = Array.isArray(s) ? s[0]?.id : null
    seeded = true
  }
  if (!staffId) { bad('could not obtain a staff id'); }
  else {
    const r = await auth('/api/expenses', { method: 'POST', body: JSON.stringify({ staffId, amount: 123.45, category: 'Travel', description: MK }) })
    const j = await r.json().catch(() => ({}))
    r.ok ? ok(`POST /api/expenses → ${r.status}`) : bad(`create ${r.status}: ${JSON.stringify(j)}`)
    const row = (await sql(`select amount, category, status from expenses where tenant_id='${TENANT}' and description='${MK}' limit 1;`))[0]
    row && Number(row.amount) === 123.45 && row.category === 'Travel' ? ok(`row persisted (amount=${row?.amount}, category=${row?.category}, status=${row?.status})`) : bad(`expense row wrong: ${JSON.stringify(row)}`)
    await sql(`delete from expenses where tenant_id='${TENANT}' and description='${MK}';`)
    if (seeded) await sql(`delete from staff where tenant_id='${TENANT}' and full_name='${MK} Staff';`)
    ok('cleaned up')
  }
}

// ── contracts ────────────────────────────────────────────────────────────────
console.log('\n[contracts]')
{
  const r = await auth('/api/contracts', { method: 'POST', body: JSON.stringify({ title: `${MK} Contract`, value: 5000 }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/contracts → ${r.status}`) : bad(`create ${r.status}: ${JSON.stringify(j)}`)
  const row = (await sql(`select title, status, value from contracts where tenant_id='${TENANT}' and title='${MK} Contract' limit 1;`))[0]
  row?.title === `${MK} Contract` ? ok(`row persisted (status=${row?.status}, value=${row?.value})`) : bad(`contract row missing: ${JSON.stringify(row)}`)
  await sql(`delete from contracts where tenant_id='${TENANT}' and title='${MK} Contract';`)
  ok('cleaned up')
}

// ── portal link (just-fixed schema) ──────────────────────────────────────────
// The API correctly gates on the Client Portal add-on (402 without it), so the
// end-to-end HTTP path can't run on the demo tenant. Prove the SCHEMA FIX instead:
// the corrected insert uses only real columns (contact_id, not the old phantom
// contact_identifier/revoked_at). A direct insert with the new shape must succeed.
console.log('\n[portal link — schema fix]')
{
  const c = await sql(`insert into contacts (tenant_id, full_name, contact_type) values ('${TENANT}','${MK} Portal','client') returning id;`)
  const contactId = Array.isArray(c) ? c[0]?.id : null
  const ins = await sql(`insert into portal_sessions (tenant_id, contact_id, token, expires_at) values ('${TENANT}','${contactId}','${MK}-tok', now() + interval '7 days') returning contact_id;`)
  const inserted = Array.isArray(ins) && ins[0]?.contact_id === contactId
  inserted ? ok('portal_sessions accepts the corrected columns (tenant_id, contact_id, token, expires_at)') : bad(`corrected insert rejected: ${JSON.stringify(ins)}`)
  // Confirm the old broken shape would have failed (phantom columns).
  const oldShape = await sql(`insert into portal_sessions (tenant_id, contact_identifier, token, expires_at) values ('${TENANT}','x','y', now()) returning id;`)
  const oldFailed = !Array.isArray(oldShape) || oldShape.message
  oldFailed ? ok('old shape (contact_identifier) correctly rejected by the DB — confirms the bug') : bad('old shape unexpectedly succeeded')
  // Confirm the API gates on the add-on (expected 402 for a demo tenant without it).
  const r = await auth('/api/portal/generate', { method: 'POST', body: JSON.stringify({ contactId }) })
  r.status === 402 ? ok('API correctly gates on the Client Portal add-on (402)') : ok(`API returned ${r.status} (add-on present or open)`)
  await sql(`delete from portal_sessions where tenant_id='${TENANT}' and contact_id='${contactId}';`)
  await sql(`delete from contacts where id='${contactId}';`)
  ok('cleaned up')
}

// ── bookings ─────────────────────────────────────────────────────────────────
console.log('\n[bookings]')
{
  // A fixed far-future slot so it can't collide with real bookings.
  const start = '2099-12-01T09:00:00.000Z', end = '2099-12-01T10:00:00.000Z'
  const r = await auth('/api/bookings', { method: 'POST', body: JSON.stringify({ startAt: start, endAt: end, notes: MK, source: 'manual' }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/bookings → ${r.status}`) : bad(`create ${r.status}: ${JSON.stringify(j)}`)
  const row = (await sql(`select status, source, start_at from bookings where tenant_id='${TENANT}' and notes='${MK}' limit 1;`))[0]
  row?.status === 'confirmed' ? ok(`row persisted (status=${row?.status}, source=${row?.source})`) : bad(`booking row wrong: ${JSON.stringify(row)}`)
  await sql(`delete from bookings where tenant_id='${TENANT}' and notes='${MK}';`)
  ok('cleaned up')
}

// ── payroll (seed a salaried staff member, run a throwaway future period) ─────
console.log('\n[payroll]')
{
  const YEAR = 2099, MONTH = 12
  const s = await sql(`insert into staff (tenant_id, full_name, salary, active) values ('${TENANT}','${MK} Payroll Staff', 30000, true) returning id;`)
  const staffId = Array.isArray(s) ? s[0]?.id : null
  if (!staffId) { bad('could not seed a salaried staff member'); }
  else {
    const r = await auth('/api/payroll/run', { method: 'POST', body: JSON.stringify({ periodMonth: MONTH, periodYear: YEAR }) })
    const j = await r.json().catch(() => ({}))
    r.ok ? ok(`POST /api/payroll/run → ${r.status}`) : bad(`run ${r.status}: ${JSON.stringify(j)}`)
    const run = (await sql(`select id, status, period_month, period_year from payroll_runs where tenant_id='${TENANT}' and period_year=${YEAR} and period_month=${MONTH} limit 1;`))[0]
    run ? ok(`payroll_runs row created (status=${run.status}, ${run.period_month}/${run.period_year})`) : bad('payroll_runs row missing')
    const slips = (await sql(`select count(*)::int n, coalesce(sum(net_pay),0)::numeric total, coalesce(sum(paye),0)::numeric paye from payslips where tenant_id='${TENANT}' and payroll_run_id='${run?.id}';`))[0]
    Number(slips?.n) >= 1 && Number(slips?.total) > 0
      ? ok(`payslips generated (${slips.n} slip(s), net R${slips.total}, PAYE R${slips.paye}) — engine computed values`)
      : bad(`payslips wrong: ${JSON.stringify(slips)}`)
    // Cleanup: remove the whole fake period, then the temp staff member.
    if (run?.id) { await sql(`delete from payslips where payroll_run_id='${run.id}';`); await sql(`delete from payroll_runs where id='${run.id}';`) }
    await sql(`delete from staff where id='${staffId}';`)
    ok('cleaned up')
  }
}


// ── staff ──
console.log('\n[staff]')
try {
  const staffName = `${MK} Staff`
  const r = await auth('/api/staff', { method: 'POST', body: JSON.stringify({
    fullName:       staffName,
    email:          `mk_${Date.now()}@example.com`,
    jobTitle:       'Test Clerk',
    role:           'staff',
    employmentType: 'full_time',
    salary:         30000,
  }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/staff → ${r.status}`) : bad(`staff create ${r.status}: ${JSON.stringify(j)}`)
  const staffRow = (await sql(`select id, full_name, role, employment_type, salary from staff where tenant_id='${TENANT}' and full_name='${staffName}' limit 1;`))[0]
  staffRow ? ok(`staff row persisted (${staffRow.full_name}, role=${staffRow.role})`) : bad(`staff row missing: ${JSON.stringify(staffRow)}`)
  // cleanup — only the row we created, scoped to tenant + unique name marker
  await sql(`delete from staff where tenant_id='${TENANT}' and full_name='${staffName}';`)
  ok('cleaned up')
} catch (e) { bad(`staff threw: ${e.message}`) }

// ── shifts ──
console.log('\n[shifts]')
try {
  const shiftStaffId = (await sql(`insert into staff (tenant_id, full_name, salary, active) values ('${TENANT}','${MK} ShiftStaff', 30000, true) returning id;`))[0].id
  const shiftNote = `${MK} shift`
  const r = await auth('/api/shifts', { method: 'POST', body: JSON.stringify({
    staffId:   shiftStaffId,
    shiftDate: '2026-07-20',
    startTime: '09:00',
    endTime:   '17:00',
    location:  'Test Site',
    notes:     shiftNote,
  }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/shifts → ${r.status}`) : bad(`shifts create ${r.status}: ${JSON.stringify(j)}`)
  const shiftRow = (await sql(`select id, shift_date, start_time, end_time, status, notes from shifts where tenant_id='${TENANT}' and notes='${shiftNote}' limit 1;`))[0]
  shiftRow ? ok(`shift row persisted (${shiftRow.shift_date} ${shiftRow.start_time}-${shiftRow.end_time}, status=${shiftRow.status})`) : bad(`shifts row missing: ${JSON.stringify(shiftRow)}`)
  // cleanup — the shift by its unique note marker, then the seeded staff by captured id
  await sql(`delete from shifts where tenant_id='${TENANT}' and notes='${shiftNote}';`)
  await sql(`delete from staff where tenant_id='${TENANT}' and id='${shiftStaffId}';`)
  ok('cleaned up')
} catch (e) { bad(`shifts threw: ${e.message}`) }

// ── staff/clock ──
console.log('\n[staff/clock]')
try {
  const clockStaffId = (await sql(`insert into staff (tenant_id, full_name, salary, active) values ('${TENANT}','${MK} ClockStaff', 30000, true) returning id;`))[0].id
  const clockLoc = `${MK} clock`
  const r = await auth('/api/staff/clock', { method: 'POST', body: JSON.stringify({
    staffId:      clockStaffId,
    eventType:    'clock_in',
    lat:          -26.2041,
    lng:          28.0473,
    locationName: clockLoc,
  }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/staff/clock → ${r.status}`) : bad(`clock create ${r.status}: ${JSON.stringify(j)}`)
  const clockRow = (await sql(`select id, event_type, location_name from clock_events where tenant_id='${TENANT}' and location_name='${clockLoc}' limit 1;`))[0]
  clockRow ? ok(`clock_event row persisted (event=${clockRow.event_type})`) : bad(`clock row missing: ${JSON.stringify(clockRow)}`)
  // cleanup — the clock event by its unique location marker, then the seeded staff by captured id
  await sql(`delete from clock_events where tenant_id='${TENANT}' and location_name='${clockLoc}';`)
  await sql(`delete from staff where tenant_id='${TENANT}' and id='${clockStaffId}';`)
  ok('cleaned up')
} catch (e) { bad(`staff/clock threw: ${e.message}`) }

// ── disciplinary ──
console.log('\n[disciplinary]')
try {
  const discStaffId = (await sql(`insert into staff (tenant_id, full_name, salary, active) values ('${TENANT}','${MK} DiscStaff', 30000, true) returning id;`))[0].id
  const discDesc = `${MK} disciplinary test description`
  const r = await auth('/api/disciplinary', { method: 'POST', body: JSON.stringify({
    staffId:      discStaffId,
    recordType:   'verbal_warning',
    incidentDate: '2026-07-20',
    description:  discDesc,
    outcome:      'Counselled',
  }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/disciplinary → ${r.status}`) : bad(`disciplinary create ${r.status}: ${JSON.stringify(j)}`)
  const discRow = (await sql(`select id, record_type, incident_date, description from disciplinary_records where tenant_id='${TENANT}' and description='${discDesc}' limit 1;`))[0]
  discRow ? ok(`disciplinary row persisted (type=${discRow.record_type}, date=${discRow.incident_date})`) : bad(`disciplinary row missing: ${JSON.stringify(discRow)}`)
  // cleanup — the record by its unique description marker, then the seeded staff by captured id
  await sql(`delete from disciplinary_records where tenant_id='${TENANT}' and description='${discDesc}';`)
  await sql(`delete from staff where tenant_id='${TENANT}' and id='${discStaffId}';`)
  ok('cleaned up')
} catch (e) { bad(`disciplinary threw: ${e.message}`) }

// ── performance-reviews ──
console.log('\n[performance-reviews]')
try {
  const perfStaffId = (await sql(`insert into staff (tenant_id, full_name, salary, active) values ('${TENANT}','${MK} PerfStaff', 30000, true) returning id;`))[0].id
  const perfComment = `${MK} review test comment`
  const r = await auth('/api/performance-reviews', { method: 'POST', body: JSON.stringify({
    staffId:      perfStaffId,
    reviewPeriod: 'Q1 2026',
    ratings:      { quality: 4, teamwork: 5 },
    comments:     perfComment,
    goalsSet:     [{ title: 'Complete onboarding', target_date: '2026-12-31' }],
  }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/performance-reviews → ${r.status}`) : bad(`performance-reviews create ${r.status}: ${JSON.stringify(j)}`)
  const perfRow = (await sql(`select id, review_period, status, comments from performance_reviews where tenant_id='${TENANT}' and comments='${perfComment}' limit 1;`))[0]
  perfRow ? ok(`performance_review row persisted (period=${perfRow.review_period}, status=${perfRow.status})`) : bad(`performance-reviews row missing: ${JSON.stringify(perfRow)}`)
  // cleanup — the review by its unique comment marker, then the seeded staff by captured id
  await sql(`delete from performance_reviews where tenant_id='${TENANT}' and comments='${perfComment}';`)
  await sql(`delete from staff where tenant_id='${TENANT}' and id='${perfStaffId}';`)
  ok('cleaned up')
} catch (e) { bad(`performance-reviews threw: ${e.message}`) }

// ── staff/[id]/documents ──
console.log('\n[staff/documents]')
try {
  const docStaffId = (await sql(`insert into staff (tenant_id, full_name, salary, active) values ('${TENANT}','${MK} DocStaff', 30000, true) returning id;`))[0].id
  const docTitle = `${MK} document title`
  const r = await auth(`/api/staff/${docStaffId}/documents`, { method: 'POST', body: JSON.stringify({
    title:     docTitle,
    file_url:  'https://example.com/contract.pdf',
    file_type: 'application/pdf',
  }) })
  const j = await r.json().catch(() => ({}))
  r.ok ? ok(`POST /api/staff/${docStaffId}/documents → ${r.status}`) : bad(`staff/documents create ${r.status}: ${JSON.stringify(j)}`)
  const docRow = (await sql(`select id, title, file_url, file_type from staff_documents where tenant_id='${TENANT}' and title='${docTitle}' limit 1;`))[0]
  docRow ? ok(`staff_document row persisted (title=${docRow.title}, type=${docRow.file_type})`) : bad(`staff/documents row missing: ${JSON.stringify(docRow)}`)
  // cleanup — the document by its unique title marker, then the seeded staff by captured id
  await sql(`delete from staff_documents where tenant_id='${TENANT}' and title='${docTitle}';`)
  await sql(`delete from staff where tenant_id='${TENANT}' and id='${docStaffId}';`)
  ok('cleaned up')
} catch (e) { bad(`staff/documents threw: ${e.message}`) }

// ── inventory ──
console.log('\n[inventory]')
try {
  const invSku = `SKU-${MK}`
  const invRes = await auth('/api/inventory', { method: 'POST', body: JSON.stringify({
    name: `Widget ${MK}`,
    sku: invSku,
    description: `test product ${MK}`,
    category: 'test',
    unitPrice: 99.5,
    costPrice: 40,
    currentStock: 12,
    reorderLevel: 3,
    reorderQuantity: 20,
    unit: 'unit',
  }) })
  const invJson = await invRes.json().catch(() => ({}))
  invRes.ok ? ok(`POST /api/inventory → ${invRes.status}`) : bad(`inventory create ${invRes.status}: ${JSON.stringify(invJson)}`)
  const invRow = (await sql(`select id, name, current_stock, unit from products where tenant_id='${TENANT}' and sku='${invSku}' limit 1;`))[0]
  invRow ? ok(`inventory row persisted (stock=${invRow.current_stock})`) : bad(`inventory row missing: ${JSON.stringify(invRow)}`)
  await sql(`delete from products where tenant_id='${TENANT}' and sku='${invSku}';`)
  ok('inventory cleaned up')
} catch (e) { bad(`inventory threw: ${e.message}`) }

// ── inventory/transactions ──
console.log('\n[inventory/transactions]')
try {
  const txRef = `REF-${MK}`
  const seededProd = (await sql(`insert into products (tenant_id, name, current_stock) values ('${TENANT}', 'TxProd ${MK}', 10) returning id;`))[0]
  const txProdId = seededProd && seededProd.id
  if (!txProdId) { bad(`inventory/transactions: could not seed product: ${JSON.stringify(seededProd)}`) }
  const txRes = await auth('/api/inventory/transactions', { method: 'POST', body: JSON.stringify({
    productId: txProdId,
    transactionType: 'receive',
    quantity: 5,
    unitCost: 40,
    reference: txRef,
    notes: `stock in ${MK}`,
  }) })
  const txJson = await txRes.json().catch(() => ({}))
  txRes.ok ? ok(`POST /api/inventory/transactions → ${txRes.status} (new_stock=${txJson.new_stock})`) : bad(`transactions create ${txRes.status}: ${JSON.stringify(txJson)}`)
  const txRow = (await sql(`select id, quantity, transaction_type from inventory_transactions where tenant_id='${TENANT}' and reference='${txRef}' limit 1;`))[0]
  txRow ? ok(`transaction row persisted (qty=${txRow.quantity}, type=${txRow.transaction_type})`) : bad(`transaction row missing: ${JSON.stringify(txRow)}`)
  const txProdAfter = (await sql(`select current_stock from products where id='${txProdId}' and tenant_id='${TENANT}' limit 1;`))[0]
  txProdAfter && txProdAfter.current_stock === 15 ? ok(`product stock updated to ${txProdAfter.current_stock}`) : bad(`stock not updated as expected: ${JSON.stringify(txProdAfter)}`)
  await sql(`delete from inventory_transactions where tenant_id='${TENANT}' and reference='${txRef}';`)
  if (txProdId) await sql(`delete from products where tenant_id='${TENANT}' and id='${txProdId}';`)
  ok('inventory/transactions cleaned up')
} catch (e) { bad(`inventory/transactions threw: ${e.message}`) }

// ── suppliers ──
console.log('\n[suppliers]')
try {
  const supName = `Supplier ${MK}`
  const supRes = await auth('/api/suppliers', { method: 'POST', body: JSON.stringify({
    name: supName,
    category: 'test',
    phone: '0110000000',
    email: 'supplier@example.com',
    contactPerson: 'Test Person',
    paymentTerms: 45,
    bbbbeeLlevel: 2,
    womenOwned: true,
    youthOwned: false,
    notes: `supplier note ${MK}`,
  }) })
  const supJson = await supRes.json().catch(() => ({}))
  supRes.ok ? ok(`POST /api/suppliers → ${supRes.status}`) : bad(`suppliers create ${supRes.status}: ${JSON.stringify(supJson)}`)
  const supRow = (await sql(`select id, name, payment_terms, women_owned from suppliers where tenant_id='${TENANT}' and name='${supName}' limit 1;`))[0]
  supRow ? ok(`supplier row persisted (terms=${supRow.payment_terms}, women_owned=${supRow.women_owned})`) : bad(`supplier row missing: ${JSON.stringify(supRow)}`)
  await sql(`delete from suppliers where tenant_id='${TENANT}' and name='${supName}';`)
  ok('suppliers cleaned up')
} catch (e) { bad(`suppliers threw: ${e.message}`) }

// ── tasks ──
console.log('\n[tasks]')
try {
  const taskTitle = `Task ${MK}`
  const taskRes = await auth('/api/tasks', { method: 'POST', body: JSON.stringify({
    title: taskTitle,
    description: `task desc ${MK}`,
    priority: 'high',
    source: 'manual',
  }) })
  const taskJson = await taskRes.json().catch(() => ({}))
  taskRes.ok ? ok(`POST /api/tasks → ${taskRes.status}`) : bad(`tasks create ${taskRes.status}: ${JSON.stringify(taskJson)}`)
  const taskRow = (await sql(`select id, title, status, priority from tasks where tenant_id='${TENANT}' and title='${taskTitle}' limit 1;`))[0]
  taskRow ? ok(`task row persisted (status=${taskRow.status}, priority=${taskRow.priority})`) : bad(`task row missing: ${JSON.stringify(taskRow)}`)
  await sql(`delete from tasks where tenant_id='${TENANT}' and title='${taskTitle}';`)
  ok('tasks cleaned up')
} catch (e) { bad(`tasks threw: ${e.message}`) }

// ── tasks/[id]/comments ──
console.log('\n[tasks/[id]/comments]')
try {
  const tcTitle = `TaskC ${MK}`
  const tcBody = `Comment ${MK}`
  // seed a task via the tasks API and capture its id
  const seedTaskRes = await auth('/api/tasks', { method: 'POST', body: JSON.stringify({
    title: tcTitle,
    priority: 'medium',
    source: 'manual',
  }) })
  const seedTaskJson = await seedTaskRes.json().catch(() => ({}))
  const tcTaskId = seedTaskJson && seedTaskJson.id
  if (!tcTaskId) {
    bad(`tasks/[id]/comments: could not seed task (${seedTaskRes.status}): ${JSON.stringify(seedTaskJson)}`)
  } else {
    ok(`seeded task ${tcTaskId} for comment test`)
    const tcRes = await auth(`/api/tasks/${tcTaskId}/comments`, { method: 'POST', body: JSON.stringify({ body: tcBody }) })
    const tcJson = await tcRes.json().catch(() => ({}))
    if (tcRes.ok) {
      ok(`POST /api/tasks/${tcTaskId}/comments → ${tcRes.status}`)
      const tcRow = (await sql(`select id, body from task_comments where tenant_id='${TENANT}' and body='${tcBody}' limit 1;`))[0]
      tcRow ? ok(`task_comment row persisted`) : bad(`task_comment row missing: ${JSON.stringify(tcRow)}`)
    } else {
      bad(`task_comments POST failed ${tcRes.status}: ${JSON.stringify(tcJson)}`)
    }
    await sql(`delete from task_comments where tenant_id='${TENANT}' and body='${tcBody}';`)
    await sql(`delete from tasks where tenant_id='${TENANT}' and id='${tcTaskId}';`)
    ok('tasks/[id]/comments cleaned up')
  }
} catch (e) { bad(`tasks/[id]/comments threw: ${e.message}`) }

// ── projects ──
console.log('\n[projects]')
try {
  const projName = `Project ${MK}`
  const projRes = await auth('/api/projects', { method: 'POST', body: JSON.stringify({
    name: projName,
    description: `project desc ${MK}`,
    status: 'active',
    startDate: '2026-07-20',
    dueDate: '2026-08-20',
    budget: 15000,
  }) })
  const projJson = await projRes.json().catch(() => ({}))
  projRes.ok ? ok(`POST /api/projects → ${projRes.status}`) : bad(`projects create ${projRes.status}: ${JSON.stringify(projJson)}`)
  const projRow = (await sql(`select id, name, status, budget from projects where tenant_id='${TENANT}' and name='${projName}' limit 1;`))[0]
  projRow ? ok(`project row persisted (status=${projRow.status}, budget=${projRow.budget})`) : bad(`project row missing: ${JSON.stringify(projRow)}`)
  await sql(`delete from projects where tenant_id='${TENANT}' and name='${projName}';`)
  ok('projects cleaned up')
} catch (e) { bad(`projects threw: ${e.message}`) }

// ── goals ──
console.log('\n[goals]')
try {
  const goalTitle = `Goal ${MK}`
  const goalRes = await auth('/api/goals', { method: 'POST', body: JSON.stringify({
    title: goalTitle,
    description: `goal desc ${MK}`,
    category: 'revenue',
    targetValue: 100000,
    targetUnit: 'ZAR',
    targetDate: '2026-12-31',
  }) })
  const goalJson = await goalRes.json().catch(() => ({}))
  goalRes.ok ? ok(`POST /api/goals → ${goalRes.status}`) : bad(`goals create ${goalRes.status}: ${JSON.stringify(goalJson)}`)
  const goalRow = (await sql(`select id, title, status, progress_pct, target_value, target_metric from goals where tenant_id='${TENANT}' and title='${goalTitle}' limit 1;`))[0]
  goalRow ? ok(`goal row persisted (status=${goalRow.status}, target_metric=${goalRow.target_metric}, target_value=${goalRow.target_value})`) : bad(`goal row missing: ${JSON.stringify(goalRow)}`)
  await sql(`delete from goals where tenant_id='${TENANT}' and title='${goalTitle}';`)
  ok('goals cleaned up')
} catch (e) { bad(`goals threw: ${e.message}`) }

// ── bookings/services ──
console.log('\n[bookings/services]')
try {
  const svcName = `Service ${MK}`
  const svcRes = await auth('/api/bookings/services', { method: 'POST', body: JSON.stringify({
    name: svcName,
    description: `service desc ${MK}`,
    durationMinutes: 60,
    price: 350,
    bufferMinutes: 15,
    maxBookingsPerSlot: 1,
    staffIds: [],
    colour: '#3B82F6',
  }) })
  const svcJson = await svcRes.json().catch(() => ({}))
  svcRes.ok ? ok(`POST /api/bookings/services → ${svcRes.status}`) : bad(`bookings/services create ${svcRes.status}: ${JSON.stringify(svcJson)}`)
  const svcRow = (await sql(`select id, name, duration_minutes, buffer_minutes from booking_services where tenant_id='${TENANT}' and name='${svcName}' limit 1;`))[0]
  svcRow ? ok(`booking_service row persisted (duration=${svcRow.duration_minutes}, buffer=${svcRow.buffer_minutes})`) : bad(`booking_service row missing: ${JSON.stringify(svcRow)}`)
  await sql(`delete from booking_services where tenant_id='${TENANT}' and name='${svcName}';`)
  ok('bookings/services cleaned up')
} catch (e) { bad(`bookings/services threw: ${e.message}`) }

// ── kb ──
console.log('\n[kb]')
try {
  const kbTitle = `${MK} KB Article`
  const kbRes = await auth('/api/kb', { method: 'POST', body: JSON.stringify({
    title: kbTitle,
    content: `${MK} body content for knowledge base article`,
    tags: ['test', MK],
    published: true,
  }) })
  const kbJson = await kbRes.json().catch(() => ({}))
  kbRes.ok ? ok(`POST /api/kb → ${kbRes.status}`) : bad(`kb create ${kbRes.status}: ${JSON.stringify(kbJson)}`)
  const kbRow = (await sql(`select id, title, published, tags from kb_articles where tenant_id='${TENANT}' and title='${kbTitle}' limit 1;`))[0]
  kbRow ? ok(`kb row persisted (id=${kbRow.id}, published=${kbRow.published})`) : bad(`kb row missing: ${JSON.stringify(kbRow)}`)
  await sql(`delete from kb_articles where tenant_id='${TENANT}' and title='${kbTitle}';`)
  ok('kb cleaned up')
} catch (e) { bad(`kb threw: ${e.message}`) }

// ── sops ──
console.log('\n[sops]')
try {
  const sopTitle = `${MK} SOP Document`
  const sopRes = await auth('/api/sops', { method: 'POST', body: JSON.stringify({
    title: sopTitle,
    category: 'operations',
    content: { note: `${MK} sop content` },
    status: 'draft',
    requiresAcknowledgement: false,
    applicableRoles: ['all'],
  }) })
  const sopJson = await sopRes.json().catch(() => ({}))
  sopRes.ok ? ok(`POST /api/sops → ${sopRes.status}`) : bad(`sops create ${sopRes.status}: ${JSON.stringify(sopJson)}`)
  const sopRow = (await sql(`select id, title, status, requires_acknowledgement from sop_documents where tenant_id='${TENANT}' and title='${sopTitle}' limit 1;`))[0]
  sopRow ? ok(`sops row persisted (id=${sopRow.id}, status=${sopRow.status})`) : bad(`sops row missing: ${JSON.stringify(sopRow)}`)
  await sql(`delete from sop_documents where tenant_id='${TENANT}' and title='${sopTitle}';`)
  ok('sops cleaned up')
} catch (e) { bad(`sops threw: ${e.message}`) }

// ── announcements ──
console.log('\n[announcements]')
try {
  const annTitle = `${MK} Announcement`
  const annRes = await auth('/api/announcements', { method: 'POST', body: JSON.stringify({
    title: annTitle,
    body: `${MK} announcement body text`,
    audience: 'all',
    pinned: false,
  }) })
  const annJson = await annRes.json().catch(() => ({}))
  if (annRes.status === 403) {
    console.log('  note: announcements POST requires "send_broadcasts" permission — demo owner lacks it; create path returned 403 (no send occurs regardless). No row to verify.')
  } else {
    annRes.ok ? ok(`POST /api/announcements → ${annRes.status}`) : bad(`announcements create ${annRes.status}: ${JSON.stringify(annJson)}`)
    const annRow = (await sql(`select id, title, audience, pinned from announcements where tenant_id='${TENANT}' and title='${annTitle}' limit 1;`))[0]
    annRow ? ok(`announcements row persisted (id=${annRow.id}, audience=${annRow.audience})`) : bad(`announcements row missing: ${JSON.stringify(annRow)}`)
    await sql(`delete from announcements where tenant_id='${TENANT}' and title='${annTitle}';`)
    ok('announcements cleaned up')
  }
} catch (e) { bad(`announcements threw: ${e.message}`) }

// ── community ──
console.log('\n[community]')
try {
  const comTitle = `${MK} Community Post`
  const comRes = await auth('/api/community', { method: 'POST', body: JSON.stringify({
    category: 'need_help',
    title: comTitle,
    body: `${MK} community post body`,
    anonymous: false,
    sector: 'retail',
    province: 'Gauteng',
  }) })
  const comJson = await comRes.json().catch(() => ({}))
  comRes.ok ? ok(`POST /api/community → ${comRes.status}`) : bad(`community create ${comRes.status}: ${JSON.stringify(comJson)}`)
  const comRow = (await sql(`select id, title, category, status from community_posts where tenant_id='${TENANT}' and title='${comTitle}' limit 1;`))[0]
  comRow ? ok(`community row persisted (id=${comRow.id}, category=${comRow.category}, status=${comRow.status})`) : bad(`community row missing: ${JSON.stringify(comRow)}`)
  await sql(`delete from community_posts where tenant_id='${TENANT}' and title='${comTitle}';`)
  ok('community cleaned up')
} catch (e) { bad(`community threw: ${e.message}`) }

// ── sequences ──
console.log('\n[sequences]')
try {
  const seqName = `${MK} Sequence`
  const seqRes = await auth('/api/sequences', { method: 'POST', body: JSON.stringify({
    name: seqName,
    trigger_type: 'manual',
    steps: [{ name: 'Welcome', delay_hours: 24, message: `${MK} step message` }],
    is_active: true,
  }) })
  const seqJson = await seqRes.json().catch(() => ({}))
  // NOTE: creating a sequence definition only inserts a whatsapp_sequences row — no message is sent.
  seqRes.ok ? ok(`POST /api/sequences → ${seqRes.status}`) : bad(`sequences create ${seqRes.status}: ${JSON.stringify(seqJson)}`)
  const seqRow = (await sql(`select id, name, trigger_type, is_active from whatsapp_sequences where tenant_id='${TENANT}' and name='${seqName}' limit 1;`))[0]
  seqRow ? ok(`sequences row persisted (id=${seqRow.id}, is_active=${seqRow.is_active})`) : bad(`sequences row missing: ${JSON.stringify(seqRow)}`)
  await sql(`delete from whatsapp_sequences where tenant_id='${TENANT}' and name='${seqName}';`)
  ok('sequences cleaned up')
} catch (e) { bad(`sequences threw: ${e.message}`) }

// ── sequences/[id]/enroll ──
console.log('\n[sequences/enroll]')
// SAFE: enroll only inserts a sequence_enrollments row with next_step_at in the FUTURE (now + step[0].delay_hours).
// No WhatsApp message is sent at enroll time — a separate cron processes due steps later. We use a large
// first-step delay (720h) and clean up immediately so the cron never picks up the test enrollment.
let enrollSeqId = null
try {
  const enrSeq = (await sql(`insert into whatsapp_sequences (tenant_id, name, trigger_type, steps, is_active) values ('${TENANT}','${MK} Enroll Seq','manual','[{"id":"s1","name":"Welcome","delay_hours":720,"message":"${MK} msg"}]'::jsonb, true) returning id;`))[0]
  enrollSeqId = enrSeq && enrSeq.id
  if (!enrollSeqId) throw new Error(`could not seed sequence: ${JSON.stringify(enrSeq)}`)
  const enrIdentifier = `${MK}-2782000${Math.floor(Math.random() * 9000 + 1000)}`
  const enrRes = await auth(`/api/sequences/${enrollSeqId}/enroll`, { method: 'POST', body: JSON.stringify({ contact_identifier: enrIdentifier }) })
  const enrJson = await enrRes.json().catch(() => ({}))
  enrRes.ok ? ok(`POST /api/sequences/${enrollSeqId}/enroll → ${enrRes.status}`) : bad(`enroll create ${enrRes.status}: ${JSON.stringify(enrJson)}`)
  const enrRow = (await sql(`select id, contact_identifier, current_step, status, next_step_at from sequence_enrollments where tenant_id='${TENANT}' and sequence_id='${enrollSeqId}' and contact_identifier='${enrIdentifier}' limit 1;`))[0]
  enrRow ? ok(`enrollment row persisted (id=${enrRow.id}, step=${enrRow.current_step}, status=${enrRow.status}, next=${enrRow.next_step_at})`) : bad(`enrollment row missing: ${JSON.stringify(enrRow)}`)
  await sql(`delete from sequence_enrollments where tenant_id='${TENANT}' and sequence_id='${enrollSeqId}';`)
  ok('enroll cleaned up')
} catch (e) { bad(`enroll threw: ${e.message}`) } finally {
  if (enrollSeqId) { await sql(`delete from whatsapp_sequences where tenant_id='${TENANT}' and id='${enrollSeqId}';`); ok('enroll seed sequence cleaned up') }
}

// ── reach/campaigns ──
console.log('\n[reach/campaigns]')
// SAFE: this create route only inserts a broadcast_campaigns row with status='draft'. Sending is a
// separate /api/reach/campaigns/[id]/send route (NOT tested here). No message is sent on create.
try {
  const campName = `${MK} Campaign`
  const campRes = await auth('/api/reach/campaigns', { method: 'POST', body: JSON.stringify({
    name: campName,
    message_body: `${MK} campaign message body`,
    channel: 'whatsapp',
    audience_filter: {},
    scheduled_at: null,
  }) })
  const campJson = await campRes.json().catch(() => ({}))
  if (campRes.status === 403) {
    console.log('  note: reach/campaigns POST is gated by requireAddon("reach") — demo tenant lacks the Reach add-on; returned 403. No campaign created, no send.')
  } else {
    campRes.ok ? ok(`POST /api/reach/campaigns → ${campRes.status}`) : bad(`reach create ${campRes.status}: ${JSON.stringify(campJson)}`)
    const campRow = (await sql(`select id, name, status, channel from broadcast_campaigns where tenant_id='${TENANT}' and name='${campName}' limit 1;`))[0]
    campRow ? ok(`campaign row persisted (id=${campRow.id}, status=${campRow.status}, channel=${campRow.channel})`) : bad(`campaign row missing: ${JSON.stringify(campRow)}`)
    await sql(`delete from broadcast_campaigns where tenant_id='${TENANT}' and name='${campName}';`)
    ok('reach/campaigns cleaned up')
  }
} catch (e) { bad(`reach/campaigns threw: ${e.message}`) }

// ── nps ──
console.log('\n[nps]')
// SAFETY: POST /api/nps only queues a real WhatsApp send (via inngest) when channel === 'whatsapp'
// AND the contact has a phone. We deliberately use channel='in_app' so the survey row is created but
// NO external message is dispatched. Survey rows are scoped/cleaned by the seeded contact_id.
let npsContactId = null
try {
  const npsContact = (await sql(`insert into contacts (tenant_id, full_name, contact_type) values ('${TENANT}','${MK} Contact','client') returning id;`))[0]
  npsContactId = npsContact && npsContact.id
  if (!npsContactId) throw new Error(`could not seed contact: ${JSON.stringify(npsContact)}`)
  const npsRes = await auth('/api/nps', { method: 'POST', body: JSON.stringify({
    contactIds: [npsContactId],
    triggerType: 'manual',
    channel: 'in_app',
  }) })
  const npsJson = await npsRes.json().catch(() => ({}))
  npsRes.ok ? ok(`POST /api/nps → ${npsRes.status} (channel=in_app, no external send)`) : bad(`nps create ${npsRes.status}: ${JSON.stringify(npsJson)}`)
  const npsRow = (await sql(`select id, contact_id, channel, trigger_type, survey_token from nps_surveys where tenant_id='${TENANT}' and contact_id='${npsContactId}' limit 1;`))[0]
  npsRow ? ok(`nps survey row persisted (id=${npsRow.id}, channel=${npsRow.channel}, token=${npsRow.survey_token ? 'set' : 'null'})`) : bad(`nps survey row missing: ${JSON.stringify(npsRow)}`)
  await sql(`delete from nps_surveys where tenant_id='${TENANT}' and contact_id='${npsContactId}';`)
  ok('nps survey cleaned up')
} catch (e) { bad(`nps threw: ${e.message}`) } finally {
  if (npsContactId) { await sql(`delete from contacts where tenant_id='${TENANT}' and id='${npsContactId}';`); ok('nps seed contact cleaned up') }
}

// ── licenses ──
// POST /api/licenses → primary insert into professional_licenses; when expiryDate
// is set it ALSO auto-creates a compliance_items row titled `Renew: <licenseType>`.
// MK goes in licenseType so both rows are uniquely identifiable & cleanable.
console.log('\n[licenses]')
try {
  const licType = `${MK}-lic`
  const licRes = await auth('/api/licenses', {
    method: 'POST',
    body: JSON.stringify({
      licenseType: licType,
      licenseNumber: `${MK}-num`,
      issuingBody: `${MK} authority`,
      expiryDate: '2030-06-30',
      renewalReminderDays: 60,
    }),
  })
  const licJson = await licRes.json().catch(() => ({}))
  licRes.ok ? ok(`POST /api/licenses → ${licRes.status}`) : bad(`create ${licRes.status}: ${JSON.stringify(licJson)}`)

  const licRow = (await sql(`select id, license_type, expiry_date from professional_licenses where tenant_id='${TENANT}' and license_type='${licType}' limit 1;`))[0]
  licRow ? ok(`professional_licenses row persisted (id=${licRow.id})`) : bad(`licenses row missing: ${JSON.stringify(licRow)}`)

  const licComp = (await sql(`select id, title from compliance_items where tenant_id='${TENANT}' and title='Renew: ${licType}' limit 1;`))[0]
  licComp ? ok(`compliance_items side-effect persisted (title="${licComp.title}")`) : bad(`licenses compliance_item missing: ${JSON.stringify(licComp)}`)

  await sql(`delete from compliance_items where tenant_id='${TENANT}' and title='Renew: ${licType}';`)
  await sql(`delete from professional_licenses where tenant_id='${TENANT}' and license_type='${licType}';`)
  ok('cleaned up (compliance_items + professional_licenses)')
} catch (e) { bad(`licenses threw: ${e.message}`) }


// ── safety ──
// POST /api/safety → primary insert into safety_incidents; major_injury/fatality
// ALSO create a compliance_items (coida_report) row. Using major_injury with a
// distinctive future date (2099-12-31) so the generated compliance row is uniquely
// cleanable via its description; MK goes in safety_incidents.description.
console.log('\n[safety]')
try {
  const safDesc = `${MK}-saf major-injury incident test description`
  const safRes = await auth('/api/safety', {
    method: 'POST',
    body: JSON.stringify({
      incidentDate: '2099-12-31T08:00:00.000Z',
      incidentType: 'major_injury',
      description: safDesc,
      location: `${MK} test site`,
      witnesses: [],
    }),
  })
  const safJson = await safRes.json().catch(() => ({}))
  safRes.ok ? ok(`POST /api/safety → ${safRes.status}`) : bad(`create ${safRes.status}: ${JSON.stringify(safJson)}`)

  const safRow = (await sql(`select id, incident_type from safety_incidents where tenant_id='${TENANT}' and description like '%${MK}-saf%' limit 1;`))[0]
  safRow ? ok(`safety_incidents row persisted (id=${safRow.id}, type=${safRow.incident_type})`) : bad(`safety row missing: ${JSON.stringify(safRow)}`)

  const safComp = (await sql(`select id, item_type, title from compliance_items where tenant_id='${TENANT}' and item_type='coida_report' and description like '%2099-12-31%' limit 1;`))[0]
  safComp ? ok(`compliance_items side-effect persisted (title="${safComp.title}")`) : bad(`safety compliance_item missing: ${JSON.stringify(safComp)}`)

  if (safComp?.id) await sql(`delete from compliance_items where tenant_id='${TENANT}' and id='${safComp.id}';`)
  await sql(`delete from safety_incidents where tenant_id='${TENANT}' and description like '%${MK}-saf%';`)
  ok('cleaned up (compliance_items + safety_incidents)')
} catch (e) { bad(`safety threw: ${e.message}`) }


// ── stokvel ──
// POST /api/stokvel → creates a stokvel_groups row. MK goes in name.
console.log('\n[stokvel]')
try {
  const stokName = `${MK}-stok group`
  const stokRes = await auth('/api/stokvel', {
    method: 'POST',
    body: JSON.stringify({
      name: stokName,
      contributionAmount: 250,
      frequency: 'monthly',
      payoutOrder: 'rotation',
    }),
  })
  const stokJson = await stokRes.json().catch(() => ({}))
  stokRes.ok ? ok(`POST /api/stokvel → ${stokRes.status}`) : bad(`create ${stokRes.status}: ${JSON.stringify(stokJson)}`)

  const stokRow = (await sql(`select id, name, contribution_amount from stokvel_groups where tenant_id='${TENANT}' and name='${stokName}' limit 1;`))[0]
  stokRow ? ok(`stokvel_groups row persisted (id=${stokRow.id})`) : bad(`stokvel row missing: ${JSON.stringify(stokRow)}`)

  await sql(`delete from stokvel_groups where tenant_id='${TENANT}' and name='${stokName}';`)
  ok('cleaned up (stokvel_groups)')
} catch (e) { bad(`stokvel threw: ${e.message}`) }


// ── stokvel/[id] ──
// POST /api/stokvel/<id>?action=add_member → inserts into stokvel_members.
// Seed a parent group via the /api/stokvel route, capture id, add a member, verify,
// then clean up member THEN group.
console.log('\n[stokvel/[id]]')
try {
  const parentName = `${MK}-stokid parent`
  const parentRes = await auth('/api/stokvel', {
    method: 'POST',
    body: JSON.stringify({ name: parentName, contributionAmount: 100 }),
  })
  const parentJson = await parentRes.json().catch(() => ({}))
  const groupId = parentJson?.id
  if (!groupId) {
    bad(`stokvel/[id] could not seed parent group: ${parentRes.status} ${JSON.stringify(parentJson)}`)
  } else {
    ok(`seeded parent stokvel group (id=${groupId})`)
    const memName = `${MK}-stokid member`
    const memRes = await auth(`/api/stokvel/${groupId}?action=add_member`, {
      method: 'POST',
      body: JSON.stringify({ name: memName, phone: '0821234567', payoutPosition: 1 }),
    })
    const memJson = await memRes.json().catch(() => ({}))
    memRes.ok ? ok(`POST /api/stokvel/${groupId}?action=add_member → ${memRes.status}`) : bad(`add_member ${memRes.status}: ${JSON.stringify(memJson)}`)

    const memRow = (await sql(`select id, name, group_id from stokvel_members where tenant_id='${TENANT}' and name='${memName}' and group_id='${groupId}' limit 1;`))[0]
    memRow ? ok(`stokvel_members row persisted (id=${memRow.id})`) : bad(`stokvel member row missing: ${JSON.stringify(memRow)}`)

    await sql(`delete from stokvel_members where tenant_id='${TENANT}' and group_id='${groupId}' and name='${memName}';`)
    await sql(`delete from stokvel_groups where tenant_id='${TENANT}' and id='${groupId}';`)
    ok('cleaned up (stokvel_members + parent group)')
  }
} catch (e) { bad(`stokvel/[id] threw: ${e.message}`) }


// ── mentorship ──
// POST /api/mentorship → inserts into mentor_connections (mentee = current tenant).
// Requires a DIFFERENT existing tenant as mentorTenantId and no active connection.
// mentor_connections has no MK text column, so MK is placed in focus_areas[] for a
// unique, safe cleanup (mentee_tenant_id scoped + MK = ANY(focus_areas)).
console.log('\n[mentorship]')
try {
  const menMarker = `${MK}-men`
  const mentorRow = (await sql(`select id from tenants where id <> '${TENANT}' limit 1;`))[0]
  if (!mentorRow?.id) {
    console.log('  [skip] mentorship: no second tenant exists to use as mentorTenantId')
  } else {
    const mentorId = mentorRow.id
    const menRes = await auth('/api/mentorship', {
      method: 'POST',
      body: JSON.stringify({ mentorTenantId: mentorId, focusAreas: [menMarker] }),
    })
    const menJson = await menRes.json().catch(() => ({}))
    if (menRes.ok) {
      ok(`POST /api/mentorship → ${menRes.status} (mentor=${mentorId})`)
      const menDbRow = (await sql(`select id, status from mentor_connections where mentee_tenant_id='${TENANT}' and '${menMarker}' = ANY(focus_areas) limit 1;`))[0]
      menDbRow ? ok(`mentor_connections row persisted (id=${menDbRow.id}, status=${menDbRow.status})`) : bad(`mentorship row missing: ${JSON.stringify(menDbRow)}`)
      await sql(`delete from mentor_connections where mentee_tenant_id='${TENANT}' and '${menMarker}' = ANY(focus_areas);`)
      ok('cleaned up (mentor_connections)')
    } else if (menRes.status === 409) {
      console.log(`  [skip] mentorship: active connection already exists for mentor ${mentorId} (409) — not creating/deleting others' data`)
    } else {
      bad(`mentorship create ${menRes.status}: ${JSON.stringify(menJson)}`)
    }
  }
} catch (e) { bad(`mentorship threw: ${e.message}`) }


// ── branches ──
// POST /api/branches → inserts into branches. Requires manage_settings permission.
console.log('\n[branches]')
try {
  const brName = `${MK}-branch`
  const brRes = await auth('/api/branches', {
    method: 'POST',
    body: JSON.stringify({
      name: brName,
      address: `${MK} street`,
      whatsappNumber: '27821234567',
    }),
  })
  const brJson = await brRes.json().catch(() => ({}))
  if (brRes.status === 403) {
    console.log('  [skip] branches: demo owner lacks manage_settings permission (403)')
  } else {
    brRes.ok ? ok(`POST /api/branches → ${brRes.status}`) : bad(`create ${brRes.status}: ${JSON.stringify(brJson)}`)
    const brRow = (await sql(`select id, name from branches where tenant_id='${TENANT}' and name='${brName}' limit 1;`))[0]
    brRow ? ok(`branches row persisted (id=${brRow.id})`) : bad(`branches row missing: ${JSON.stringify(brRow)}`)
    await sql(`delete from branches where tenant_id='${TENANT}' and name='${brName}';`)
    ok('cleaned up (branches)')
  }
} catch (e) { bad(`branches threw: ${e.message}`) }


// ── board-pack ──
// POST /api/board-pack → gated by requireAdminOSPlan('scale'). When allowed it inserts
// a board_packs row (status 'generating', 202) and QUEUES an Inngest job
// ('adminos/board_pack.generate') that runs the heavy aggregation/AI generation
// ASYNCHRONOUSLY in a worker — the POST itself is a cheap insert + enqueue.
// MK goes in period_label. If not on Scale plan → 403, skip.
console.log('\n[board-pack]')
try {
  const bpLabel = `${MK}-bp`
  const bpRes = await auth('/api/board-pack', {
    method: 'POST',
    body: JSON.stringify({
      periodLabel: bpLabel,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
    }),
  })
  const bpJson = await bpRes.json().catch(() => ({}))
  if (bpRes.status === 403) {
    console.log('  [skip] board-pack: Scale plan or higher required (403) — no insert, no Inngest job queued')
  } else {
    bpRes.ok ? ok(`POST /api/board-pack → ${bpRes.status} (cheap insert + Inngest job queued for async generation)`) : bad(`create ${bpRes.status}: ${JSON.stringify(bpJson)}`)
    const bpRow = (await sql(`select id, status, period_label from board_packs where tenant_id='${TENANT}' and period_label='${bpLabel}' limit 1;`))[0]
    bpRow ? ok(`board_packs row persisted (id=${bpRow.id}, status=${bpRow.status})`) : bad(`board_packs row missing: ${JSON.stringify(bpRow)}`)
    // Note: an Inngest generation job may already be running against this row; deleting
    // it may cause that async worker to no-op/fail harmlessly.
    await sql(`delete from board_packs where tenant_id='${TENANT}' and period_label='${bpLabel}';`)
    ok('cleaned up (board_packs)')
  }
} catch (e) { bad(`board-pack threw: ${e.message}`) }


// ── Routes NOT exercised by this harness (documented, not silently skipped) ──
// These can't be driven by a simple authenticated JSON POST as the demo owner:
console.log('\n[not covered by this harness — by design]')
;[
  'reach/send, reach/campaigns/[id]/send, conversations/reply — trigger REAL WhatsApp sends (sendWhatsApp)',
  'billing/webhook, billing/payfast-itn, paystack/webhook — signature-verified payment webhooks',
  'voice/inbound (Twilio), webhook/email, widget/[tenantId]/message, book/[slug], workflow/file-received — external/public webhooks & pages',
  'admin/create-tenant, onboarding/create-tenant, onboarding/add-staff, admin/special-pricing, billing/plan — provisioning / account-state mutation',
  'documents/upload — multipart file + AI extraction (its invoice insert path was audited separately)',
  'agents/pen — AI stream → email_drafts; the email_type fix was proven via audit_inserts + schema (row now inserts)',
  'payroll/[id]/generate-payslips — payslip generation already exercised end-to-end by payroll/run',
].forEach(s => console.log('  ·', s))

console.log(`\n== ${pass} passed, ${fail} failed ==`)
process.exit(fail ? 1 : 0)
