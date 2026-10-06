// Provision the 7 Workstream D persona tenants in prod (BUILD_JOURNEY Session 20).
//
// Each persona gets their own tenant (slug qa-persona-<key>, business_type set
// so the industry nav filter is exercised) and signs in with THEIR OWN role.
// Non-owner personas get an owner login alongside them. Tenants are built the
// way real signups are: roles seeded from the role matrix, user_roles granted,
// tenant claim in app_metadata, SA statutory calendar (lib/compliance/calendar.ts).
//
// Idempotent: tenants/users/roles are found-or-created; each data table is
// seeded only while it has zero rows for that tenant. No email is ever sent
// (users are created pre-confirmed through the admin API).
//
//   node scripts/qa-personas.mjs              provision / repair all 7
//   node scripts/qa-personas.mjs --list       print the logins (no passwords)
//   node scripts/qa-personas.mjs --password salon   print one persona's password
//
// Passwords are derived from the service-role key (scripts/lib/qa.mjs) — never
// stored. QA data is tagged and stays for regression runs; remove by soft delete.
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/auth/roleMatrix.ts'
import { select, insert, update, ensureUser, personaPassword } from './lib/qa.mjs'

const mail = (tag) => `nandaregine+persona-${tag}@gmail.com`

// ── Dates: every time is a SAST wall-clock time stored as UTC ────────────────
const DAY = 86_400_000
const sastToday = new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10)
const sastDay = (offset) => new Date(Date.parse(sastToday) + offset * DAY).toISOString().slice(0, 10)
const sastAt = (offset, hh, mm = 0) => new Date(Date.parse(`${sastDay(offset)}T00:00:00Z`) + ((hh - 2) * 60 + mm) * 60_000).toISOString()

// ── The seven personas ───────────────────────────────────────────────────────
// staff[0] is always the owner; the persona's own staff row is flagged `me`.
export const PERSONAS = [
  {
    key: 'salon', name: 'Lindiwe Hair & Beauty', business_type: 'salons', plan: 'grow', city: 'Mdantsane',
    persona: { name: 'Lindiwe Mbatha', role: 'owner' },
    staff: [
      { full_name: 'Lindiwe Mbatha', role: 'owner', job_title: 'Owner / Senior Stylist', salary: 0, me: true },
      { full_name: 'Ayanda Qwabe', role: 'staff', job_title: 'Stylist', salary: 7800 },
      { full_name: 'Thandeka Mfeka', role: 'staff', job_title: 'Stylist', salary: 7500 },
      { full_name: 'Siphokazi Nkala', role: 'staff', job_title: 'Nail Technician', salary: 6800, employment_type: 'part_time' },
    ],
    services: [
      { name: 'Wash & blow-dry', duration_minutes: 45, price: 250 },
      { name: 'Knotless braids (medium)', duration_minutes: 300, price: 850 },
      { name: 'Relaxer & treatment', duration_minutes: 90, price: 480 },
      { name: 'Gel nails', duration_minutes: 60, price: 300 },
    ],
    products: [
      { name: 'Dark & Lovely relaxer kit', sku: 'REL-DL', category: 'Hair care', unit_price: 120, cost_price: 78, current_stock: 14, reorder_level: 6, unit: 'kit' },
      { name: 'Braiding hair (X-pression)', sku: 'BRD-XP', category: 'Hair', unit_price: 45, cost_price: 28, current_stock: 4, reorder_level: 20, unit: 'pack' },
      { name: 'Gel polish (assorted)', sku: 'GEL-01', category: 'Nails', unit_price: 95, cost_price: 55, current_stock: 22, reorder_level: 8, unit: 'bottle' },
    ],
    contacts: ['Nosipho Jali', 'Babalwa Tyali', 'Zintle Gcaza', 'Ntombi Sopete', 'Lerato Mokoena'],
    invoiceItems: [['Knotless braids (medium)', 1, 850], ['Wash & blow-dry', 1, 250], ['Gel nails', 2, 300]],
    tasks: ['Restock braiding hair before Saturday', 'Confirm Saturday bridal party (5 heads)', 'Deep-clean basins and dryers'],
  },
  {
    key: 'ngo', name: 'Masakhane Community Trust', business_type: 'ngo', plan: 'operate', city: 'East London',
    persona: { name: 'Nomsa Gqola', role: 'admin' },
    staff: [
      { full_name: 'Reverend Mzwandile Bam', role: 'owner', job_title: 'Chairperson', salary: 0 },
      { full_name: 'Nomsa Gqola', role: 'admin', job_title: 'Finance & Admin Officer', salary: 18500, me: true },
      { full_name: 'Phumeza Ndamase', role: 'staff', job_title: 'Programme Coordinator', salary: 14000 },
      { full_name: 'Luvuyo Sityata', role: 'staff', job_title: 'Youth Facilitator', salary: 9500 },
      { full_name: 'Asanda Mkhize', role: 'staff', job_title: 'Youth Facilitator', salary: 9500 },
      { full_name: 'Nolubabalo Peter', role: 'staff', job_title: 'Community Health Worker', salary: 8200 },
    ],
    contacts: ['National Lottery Commission', 'Buffalo City Metro (grant desk)', 'DG Murray Trust', 'Old Mutual Foundation', 'Mrs Patricia Venter (donor)'],
    invoiceItems: [['Venue hire - community hall', 1, 2500], ['Skills workshop facilitation', 2, 3500]],
    tasks: ['Prepare Q3 donor report for DG Murray Trust', 'NPO annual report - collect AFS from auditor', 'Reconcile petty cash for September'],
    expenses: [['Taxi fares - youth camp transport', 1450, 'travel'], ['Workshop stationery', 620, 'stationery']],
  },
  {
    key: 'trades', name: 'Bayview Building Contractors', business_type: 'trades', plan: 'operate', city: 'Gqeberha',
    persona: { name: 'Sipho Ngcobo', role: 'manager' },
    staff: [
      { full_name: 'Andile Ntsikelelo', role: 'owner', job_title: 'Managing Member', salary: 0 },
      { full_name: 'Sipho Ngcobo', role: 'manager', job_title: 'Site Manager', salary: 24000, me: true },
      { full_name: 'Bheki Tshabalala', role: 'staff', job_title: 'Bricklayer', salary: 9800 },
      { full_name: 'Mandla Jiyane', role: 'staff', job_title: 'General Labourer', salary: 6200 },
      { full_name: 'Pieter Smit', role: 'staff', job_title: 'Electrician', salary: 16500 },
    ],
    products: [
      { name: 'Cement 50kg (PPC)', sku: 'CEM-50', category: 'Materials', unit_price: 118, cost_price: 96, current_stock: 60, reorder_level: 80, unit: 'bag' },
      { name: 'Building sand', sku: 'SND-M3', category: 'Materials', unit_price: 650, cost_price: 480, current_stock: 6, reorder_level: 4, unit: 'm3' },
      { name: 'Maxi brick', sku: 'BRK-MX', category: 'Materials', unit_price: 3.4, cost_price: 2.6, current_stock: 4200, reorder_level: 2000, unit: 'each' },
    ],
    suppliers: [
      { name: 'Coastal Builders Warehouse', category: 'Building Materials', contact_person: 'Ruan Fourie', payment_terms: 30 },
      { name: 'Nelson Mandela Bay Readymix', category: 'Concrete', contact_person: 'Zola Mapela', payment_terms: 14 },
    ],
    contacts: ['Walmer Heights Body Corporate', 'Mr & Mrs Govender (Summerstrand)', 'Kwazakhele Clinic (DPW project)', 'Thabo Molefe'],
    invoiceItems: [['Progress claim 2 - foundations & slab', 1, 85000], ['Variation order: extra retaining wall', 1, 18500]],
    tasks: ['Pour slab at Govender site (Thursday)', 'Toolbox talk: working at heights', 'Order 120 bags cement for Walmer Heights'],
    leave: { start: 9, end: 11, days: 3, leave_type: 'annual', reason: 'Family wedding in Mthatha' },
  },
  {
    key: 'clinic', name: 'Ikhwezi Family Practice', business_type: 'clinic', plan: 'grow', city: 'Mthatha',
    persona: { name: 'Zanele Dumisa', role: 'staff' },
    staff: [
      { full_name: 'Dr Thembeka Majola', role: 'owner', job_title: 'General Practitioner', salary: 0 },
      { full_name: 'Zanele Dumisa', role: 'staff', job_title: 'Receptionist', salary: 8900, me: true },
      { full_name: 'Sister Nonkululeko Bota', role: 'staff', job_title: 'Professional Nurse', salary: 21000 },
    ],
    services: [
      { name: 'GP consultation', duration_minutes: 20, price: 520 },
      { name: 'Chronic medication review', duration_minutes: 30, price: 650 },
      { name: 'Child immunisation', duration_minutes: 15, price: 180 },
    ],
    contacts: ['Mrs Nosiphiwo Ngxola', 'Mr Vuyani Mbiko', 'Baby Lwazi Tshaka (mother: Akhona)', 'Mrs Dorothy Sobekwa', 'Mr Ayabonga Duma'],
    invoiceItems: [['GP consultation', 1, 520], ['Chronic medication review', 1, 650]],
    tasks: ['Call back Mrs Ngxola re: blood results appointment', 'File scanned medical-aid forms', 'Confirm tomorrow\'s immunisation list'],
  },
  {
    key: 'creative', name: 'Jabu Visuals Studio', business_type: 'creative', plan: 'solo', city: 'Johannesburg',
    persona: { name: 'Jabulani Khoza', role: 'owner' },
    staff: [
      { full_name: 'Jabulani Khoza', role: 'owner', job_title: 'Director / Videographer', salary: 0, me: true },
      { full_name: 'Kamo Sebata', role: 'staff', job_title: 'Editor (freelance)', salary: 12000, employment_type: 'contract' },
    ],
    contacts: ['Sowetan Wedding Co.', 'Braamfontein Brewing', 'Mpho & Karabo (wedding)', 'Afrika Rising NPC', 'Rosebank Fashion Week'],
    invoiceItems: [['Brand film - 90s hero + 3 cutdowns', 1, 38000], ['Wedding highlight film', 1, 16500], ['Drone footage day rate', 1, 4500]],
    tasks: ['Deliver Braamfontein Brewing rough cut', 'Send contract to Mpho & Karabo', 'Back up September shoots to cloud'],
  },
  {
    key: 'logistics', name: 'Buffalo City Couriers', business_type: 'logistics', plan: 'operate', city: 'East London',
    persona: { name: 'Themba Mabhena', role: 'field_agent' },
    staff: [
      { full_name: 'Yusuf Ebrahim', role: 'owner', job_title: 'Owner', salary: 0 },
      { full_name: 'Themba Mabhena', role: 'field_agent', job_title: 'Delivery Driver', salary: 9200, me: true },
      { full_name: 'Sizwe Ndude', role: 'field_agent', job_title: 'Delivery Driver', salary: 9200 },
      { full_name: 'Charlene Jacobs', role: 'manager', job_title: 'Dispatch Controller', salary: 15500 },
    ],
    products: [
      { name: 'Courier satchel (large)', sku: 'SAT-L', category: 'Packaging', unit_price: 12, cost_price: 6, current_stock: 340, reorder_level: 200, unit: 'each' },
    ],
    contacts: ['Vincent Park Pharmacy', 'Hemingways Mall - Mr Price', 'Beacon Bay Spar', 'Mrs Bulelwa Hoyi', 'Quigney Auto Spares'],
    invoiceItems: [['Same-day deliveries (September)', 42, 85], ['After-hours run', 3, 250]],
    tasks: ['Deliver 6 parcels - Vincent Park Pharmacy', 'Collect returns at Hemingways Mr Price', 'Fuel + tyre check on bakkie CA 123-456', 'Mdantsane route - 11 drops'],
  },
  {
    key: 'school', name: 'Westville Preparatory School', business_type: 'school', plan: 'operate', city: 'Durban',
    persona: { name: 'Mrs Kamini Naidoo', role: 'manager' },
    staff: [
      { full_name: 'Mr Grant Pillay', role: 'owner', job_title: 'Principal', salary: 0 },
      { full_name: 'Mrs Kamini Naidoo', role: 'manager', job_title: 'Bursar', salary: 26000, me: true },
      { full_name: 'Ms Lungile Zuma', role: 'staff', job_title: 'Grade 3 Teacher', salary: 22000 },
      { full_name: 'Mr Sean Reddy', role: 'staff', job_title: 'Grade 6 Teacher', salary: 23000 },
      { full_name: 'Mrs Fatima Moosa', role: 'staff', job_title: 'Administrator', salary: 14500 },
    ],
    contacts: ['Mr & Mrs Govender (Aarav, Gr 4)', 'Ms Thandi Ngubane (Lwazi, Gr 2)', 'Mr Rajesh Singh (Priya, Gr 6)', 'Mrs Nompumelelo Dlamini (Sbu, Gr 1)', 'Mr Craig Botha (Emma, Gr 5)'],
    invoiceItems: [['Term 4 tuition fees', 1, 14500], ['Aftercare (Term 4)', 1, 2800]],
    tasks: ['Send Term 4 fee statements', 'Follow up arrears: Botha & Dlamini accounts', 'Prepare budget for 2027 fee increase'],
    expenses: [['Photocopier toner', 2100, 'stationery'], ['Sports day medals', 950, 'other']],
  },
]

const phone = (i, j) => `+27 8${(i + j) % 4 + 1} ${String(300 + i * 11 + j).padStart(3, '0')} ${String(1000 + i * 137 + j * 17).slice(-4)}`

async function count(table, tenantId) {
  const rows = await select(table, `select=id&tenant_id=eq.${tenantId}&limit=1`)
  return rows.length
}
async function seedIfEmpty(table, tenantId, rows, log) {
  if (await count(table, tenantId)) { log.push(`${table}: kept`); return select(table, `select=*&tenant_id=eq.${tenantId}`) }
  const out = await insert(table, rows)
  log.push(`${table}: +${out.length}`)
  return out
}

async function provision(p, i) {
  const slug = `qa-persona-${p.key}`
  const log = []

  // 1. Tenant (a subscription row is auto-created by trigger).
  let [tenant] = await select('tenants', `select=id&slug=eq.${slug}`)
  const ownerEmail = mail(p.persona.role === 'owner' ? p.key : `${p.key}-owner`)
  if (!tenant) {
    ;[tenant] = await insert('tenants', {
      name: p.name, slug, plan: p.plan, business_type: p.business_type,
      country: 'ZA', language_primary: 'en', timezone: 'Africa/Johannesburg', active: true, mode: 'team',
      settings: { owner_email: ownerEmail, qa_persona: true, city: p.city, vat_registered: p.plan !== 'solo', payroll_day: 25 },
    })
    log.push('tenant: created')
  } else {
    await update('tenants', `id=eq.${tenant.id}`, { business_type: p.business_type, plan: p.plan })
  }
  const T = tenant.id
  // Comped QA subscription: active on the persona's plan, no add-ons beyond the plan.
  await update('subscriptions', `tenant_id=eq.${T}`, {
    plan: p.plan, status: 'active',
    current_period_start: new Date().toISOString(), current_period_end: new Date(Date.now() + 3650 * DAY).toISOString(),
  })

  // 2. Roles, exactly as seedDefaultRoles writes them.
  const existingRoles = await select('roles', `select=id,name&tenant_id=eq.${T}`)
  const missing = Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(([n]) => !existingRoles.some(r => r.name === n))
  if (missing.length) await insert('roles', missing.map(([name, permissions]) => ({ tenant_id: T, name, permissions, is_system: true })))
  const roles = await select('roles', `select=id,name&tenant_id=eq.${T}`)
  const roleId = (n) => roles.find(r => r.name === n).id

  // 3. Logins: the persona, plus an owner when the persona isn't one.
  const logins = [{ email: ownerEmail, name: p.staff[0].full_name, role: 'owner', staffIdx: 0 }]
  if (p.persona.role !== 'owner') logins.push({ email: mail(p.key), name: p.persona.name, role: p.persona.role, staffIdx: p.staff.findIndex(s => s.me) })
  for (const l of logins) {
    l.userId = await ensureUser(l.email, l.name, { tenant_id: T, role: l.role })
    const has = await select('user_roles', `select=id&user_id=eq.${l.userId}&tenant_id=eq.${T}`)
    if (!has.length) await insert('user_roles', { user_id: l.userId, tenant_id: T, role_id: roleId(l.role) })
    else await update('user_roles', `id=eq.${has[0].id}`, { role_id: roleId(l.role) })
  }
  const ownerId = logins[0].userId
  await update('tenants', `id=eq.${T}`, { settings: { owner_email: ownerEmail, owner_user_id: ownerId, qa_persona: true, city: p.city, vat_registered: p.plan !== 'solo', payroll_day: 25 } })

  // 4. Staff, linked to the logins.
  const staff = await seedIfEmpty('staff', T, p.staff.map((s, j) => ({
    tenant_id: T, full_name: s.full_name, role: s.role, job_title: s.job_title, department: j === 0 ? 'Management' : 'Operations',
    employment_type: s.employment_type ?? 'full_time', salary: s.salary, start_date: sastDay(-400 + j * 60),
    phone: phone(i, j), email: `${s.full_name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@example.co.za`,
    id_number: `${85 + j}0${(j % 9) + 1}15${j % 2 ? 5 : 0}80008${j}`, leave_balance: 15, leave_taken: 0, active: true,
    employee_number: `EMP-${String(j + 1).padStart(3, '0')}`,
  })), log)
  for (const l of logins) {
    const row = staff.find(s => s.full_name === p.staff[l.staffIdx].full_name)
    if (row && row.user_id !== l.userId) await update('staff', `id=eq.${row.id}`, { user_id: l.userId })
    l.staffId = row?.id
  }
  const me = logins.at(-1)
  const others = staff.filter(s => s.id !== me.staffId && s.id !== logins[0].staffId)

  // 5. Customers / clients.
  const contacts = await seedIfEmpty('contacts', T, p.contacts.map((n, j) => ({
    tenant_id: T, full_name: n, phone: phone(i + 3, j), email: `${n.toLowerCase().replace(/[^a-z]+/g, '.').slice(0, 24).replace(/\.$/, '')}@example.com`,
    contact_type: 'client', source: ['walk-in', 'referral', 'whatsapp', 'website'][j % 4], popia_consent: true, popia_consent_at: new Date().toISOString(), tags: [],
  })), log)

  // 6. Invoices: one paid, one sent (due soon), one overdue. VAT 15% when registered.
  const vatRate = p.plan === 'solo' ? 0 : 0.15
  const statuses = [['paid', -35, -20], ['sent', -5, 25], ['overdue', -50, -20]]
  await seedIfEmpty('invoices', T, statuses.map(([status, createdAgo, dueIn], j) => {
    const items = p.invoiceItems.slice(j % p.invoiceItems.length).slice(0, 2).map(([description, quantity, unitPrice]) => ({ description, quantity, unitPrice, total: quantity * unitPrice }))
    const subtotal = items.reduce((a, x) => a + x.total, 0)
    const vat = Math.round(subtotal * vatRate * 100) / 100
    const total = subtotal + vat
    const c = contacts[j % contacts.length]
    return {
      tenant_id: T, contact_id: c.id, contact_name: c.full_name, contact_phone: c.phone, contact_email: c.email,
      invoice_number: `INV-${String(1001 + j)}`, line_items: items, subtotal, vat_amount: vat, total, amount: total,
      amount_paid: status === 'paid' ? total : 0, amount_due: status === 'paid' ? 0 : total, currency: 'ZAR',
      due_date: sastDay(dueIn), status, escalation_level: status === 'overdue' ? 2 : 0,
      sent_at: sastAt(createdAgo, 10), paid_at: status === 'paid' ? sastAt(createdAgo + 12, 14) : null,
      created_by: ownerId, created_at: sastAt(createdAgo, 9),
    }
  }), log)

  // 7. Tasks: two for the persona, one for a colleague, one created by the owner unassigned.
  const taskRows = p.tasks.map((title, j) => ({
    tenant_id: T, title, status: j === 0 ? 'in_progress' : 'todo', priority: ['high', 'medium', 'low', 'medium'][j % 4],
    assigned_to: j < 2 || p.key === 'logistics' && j < 3 ? me.staffId : (others[0]?.id ?? null),
    due_date: sastAt(j, 17), source: 'manual', created_by: ownerId,
  }))
  taskRows.push({ tenant_id: T, title: 'Owner-only: review monthly management accounts', status: 'todo', priority: 'medium', assigned_to: null, due_date: sastAt(5, 17), source: 'manual', created_by: ownerId })
  await seedIfEmpty('tasks', T, taskRows, log)

  // 8. Industry extras.
  if (p.services) {
    const services = await seedIfEmpty('booking_services', T, p.services.map(s => ({ tenant_id: T, ...s, buffer_minutes: 10, max_bookings_per_slot: 1, active: true, staff_ids: staff.map(x => x.id) })), log)
    await seedIfEmpty('bookings', T, [
      { svc: 0, c: 0, day: 0, h: 9 }, { svc: 1, c: 1, day: 0, h: 11 }, { svc: 2, c: 2, day: 0, h: 14 },
      { svc: 0, c: 3, day: 1, h: 10 }, { svc: 1, c: 4, day: -1, h: 9, status: 'completed' },
    ].map((b, j) => ({
      tenant_id: T, service_id: services[b.svc % services.length].id, contact_id: contacts[b.c].id,
      staff_id: (j % 2 ? others[0] : staff[0])?.id ?? staff[0].id,
      start_at: sastAt(b.day, b.h), end_at: sastAt(b.day, b.h, services[b.svc % services.length].duration_minutes),
      status: b.status ?? 'confirmed', source: j === 1 ? 'whatsapp' : 'manual',
    })), log)
  }
  if (p.products) await seedIfEmpty('products', T, p.products.map(x => ({ tenant_id: T, reorder_quantity: x.reorder_level * 2, active: true, ...x })), log)
  if (p.suppliers) await seedIfEmpty('suppliers', T, p.suppliers.map((s, j) => ({ tenant_id: T, phone: `+27 41 400 ${1010 + j * 10}`, email: `orders@${s.name.toLowerCase().replace(/[^a-z]+/g, '')}.co.za`, rating: 4, ...s })), log)

  // 9. People: a shift for the persona today, a pending leave request, expense claims.
  await seedIfEmpty('shifts', T, [0, 1, 2].map(d => ({ tenant_id: T, staff_id: me.staffId, shift_date: sastDay(d), start_time: '08:00', end_time: '17:00', status: 'scheduled', location: p.city, created_by: ownerId })), log)
  const leave = p.leave ?? { start: 14, end: 15, days: 2, leave_type: 'annual', reason: 'Personal' }
  await seedIfEmpty('leave_requests', T, [{ tenant_id: T, staff_id: (others[0] ?? staff[0]).id, start_date: sastDay(leave.start), end_date: sastDay(leave.end), days: leave.days, leave_type: leave.leave_type, reason: leave.reason, status: 'pending' }], log)
  const exp = p.expenses ?? [['Fuel - client visits', 480, 'fuel']]
  await seedIfEmpty('expenses', T, exp.map(([description, amount, category], j) => ({ tenant_id: T, staff_id: j ? (others[0] ?? staff[0]).id : me.staffId, amount, category, description, status: 'pending', submitted_at: sastAt(-2 - j, 12) })), log)
  await seedIfEmpty('announcements', T, [
    { tenant_id: T, title: 'Welcome to AdminOS', body: `All ${p.name} team members can now see their tasks, shifts and leave here.`, audience: 'all', pinned: true, published_at: new Date().toISOString(), created_by: ownerId },
    { tenant_id: T, title: 'Management: month-end close', body: 'Month-end figures due by the 3rd.', audience: 'managers', pinned: false, published_at: new Date().toISOString(), created_by: ownerId },
  ], log)

  // 10. SA statutory calendar — lib/compliance/calendar.ts, as signup does.
  // (Statutory calendar: written by scripts/qa-calendar-sync.mjs after all tenants exist.)

  return { key: p.key, slug, tenantId: T, logins: logins.map(({ email, role, userId, staffId }) => ({ email, role, userId, staffId })), log }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
if (args[0] === '--password') {
  const p = PERSONAS.find(x => x.key === args[1])
  if (!p) { console.error('keys:', PERSONAS.map(x => x.key).join(', ')); process.exit(1) }
  const who = args[2] === 'owner' && p.persona.role !== 'owner' ? `${p.key}-owner` : p.key
  console.log(mail(who), personaPassword(mail(who)))
} else if (args[0] === '--list') {
  for (const p of PERSONAS) console.log(`${p.key.padEnd(10)} ${p.persona.role.padEnd(12)} ${mail(p.key)}${p.persona.role !== 'owner' ? `   (owner: ${mail(`${p.key}-owner`)})` : ''}`)
} else if (process.argv[1]?.endsWith('qa-personas.mjs')) {
  for (const [i, p] of PERSONAS.entries()) {
    const r = await provision(p, i)
    console.log(`\n${r.slug}  ${r.tenantId}`)
    for (const l of r.logins) console.log(`  ${l.role.padEnd(12)} ${l.email}  staff=${l.staffId ?? '-'}`)
    console.log('  ' + r.log.join(' · '))
  }
  console.log('\nstatutory calendar:')
  await import('./qa-calendar-sync.mjs')
}
