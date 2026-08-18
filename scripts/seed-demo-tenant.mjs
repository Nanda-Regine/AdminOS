// Seed realistic demo data into the QA/tester tenant "Mzansi Test Traders" so
// every page in the product reads as a real, running business — not empty.
//
// Persona: a general dealer / hardware & household goods trader in East London,
// Eastern Cape. Tenant access (plan, roles, subscription, add-ons) is already
// provisioned — this script ONLY inserts operational data rows, never touches
// tenants/subscriptions/user_roles.
//
// Idempotent: each table is seeded only if it currently has zero rows for this
// tenant (employment_equity_data uses a real upsert on its unique key instead).
// Safe to re-run — re-running after a partial seed will fill in whatever
// tables are still empty and skip the ones already seeded.
//
//   node scripts/seed-demo-tenant.mjs
//
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/).filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

// Talk to PostgREST directly with plain fetch rather than @supabase/supabase-js —
// importing that package hangs indefinitely in this environment's sandboxed
// shell (confirmed: a bare `import('@supabase/supabase-js')` never resolves,
// while raw fetch() against the same REST endpoint works instantly). Same
// service-role auth, same effect, no dependency on the client package.
const REST = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
}

const TENANT_ID = 'c1336f9c-0617-46f2-978f-605da9ad2ebc'
const OWNER_ID  = 'c60fd87f-b817-4629-b6b7-8837c73ee915' // founder@adminos-demo.co.za

const T = (x) => TENANT_ID // shorthand tag, keeps every row obviously tenant-scoped below
const now = new Date()
const daysAgo   = (n, hh = 9, mm = 0) => { const d = new Date(now); d.setDate(d.getDate() - n); d.setHours(hh, mm, 0, 0); return d }
const daysAhead = (n, hh = 9, mm = 0) => daysAgo(-n, hh, mm)
const iso   = (d) => d.toISOString()
const isoD  = (d) => d.toISOString().split('T')[0]

let report = []
function log(table, before, after) {
  report.push({ table, before, after })
  console.log(`  ${table}: ${before} -> ${after}`)
}

async function pgSelect(table, cols, filter = `tenant_id=eq.${TENANT_ID}`) {
  const res = await fetch(`${REST}/${table}?select=${encodeURIComponent(cols)}&${filter}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`select(${table}): ${res.status} ${await res.text()}`)
  return res.json()
}

async function count(table) {
  const res = await fetch(`${REST}/${table}?select=id&tenant_id=eq.${TENANT_ID}`, {
    headers: { ...HEADERS, Prefer: 'count=exact', Range: '0-0' },
  })
  if (!res.ok) throw new Error(`count(${table}): ${res.status} ${await res.text()}`)
  const range = res.headers.get('content-range') ?? ''
  const total = range.split('/')[1]
  return total && total !== '*' ? parseInt(total, 10) : 0
}

async function pgInsert(table, rows) {
  if (!rows.length) return []
  const res = await fetch(`${REST}/${table}`, {
    method: 'POST', headers: { ...HEADERS, Prefer: 'return=representation' }, body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`insert(${table}): ${res.status} ${await res.text()}`)
  return res.json()
}

async function pgUpsert(table, row, onConflict) {
  const res = await fetch(`${REST}/${table}?on_conflict=${onConflict}`, {
    method: 'POST',
    headers: { ...HEADERS, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`upsert(${table}): ${res.status} ${await res.text()}`)
  return res.json()
}

async function seedIfEmpty(table, rows) {
  const before = await count(table)
  if (before > 0) { log(table, before, before); return null }
  const data = await pgInsert(table, rows)
  const after = await count(table)
  log(table, before, after)
  return data
}

// ─────────────────────────────────────────────────────────────────────────
// 1. STAFF — nine team members, varied roles / job levels / gender / race
// ─────────────────────────────────────────────────────────────────────────
const STAFF = [
  { full_name: 'Thabo Mthembu',      role: 'Owner / Director',        job_title: 'Owner / Director',        department: 'Management', job_level: 'Top Management',           gender: 'Male',   race: 'African',  employment_type: 'full_time', salary: 45000, start_date: '2021-03-01', bank_name: 'FNB',            bank_account_number: '62012345601', id_number: '8203155800081', phone: '+27 82 111 2233', email: 'thabo.mthembu@mzansitraders.co.za', emergency_contact_name: 'Precious Mthembu', emergency_contact_phone: '+27 83 111 2244', address: '14 Frere Road, Vincent, East London' },
  { full_name: 'Nomsa Dlamini',      role: 'Store Manager',           job_title: 'Store Manager',            department: 'Management', job_level: 'Senior Management',        gender: 'Female', race: 'African',  employment_type: 'full_time', salary: 28000, start_date: '2021-06-15', bank_name: 'Standard Bank',  bank_account_number: '01123456789', id_number: '8811020800082', phone: '+27 83 222 3344', email: 'nomsa.dlamini@mzansitraders.co.za', emergency_contact_name: 'Sipho Dlamini', emergency_contact_phone: '+27 84 222 3355', address: '22 Chamberlain Road, Berea, East London' },
  { full_name: 'Priya Naidoo',       role: 'Financial Controller',    job_title: 'Financial Controller',     department: 'Finance',    job_level: 'Professionally Qualified', gender: 'Female', race: 'Indian',   employment_type: 'full_time', salary: 26000, start_date: '2022-01-10', bank_name: 'Nedbank',        bank_account_number: '1091234567',  id_number: '9004120800083', phone: '+27 71 333 4455', email: 'priya.naidoo@mzansitraders.co.za', emergency_contact_name: 'Kavir Naidoo', emergency_contact_phone: '+27 72 333 4466', address: '5 Beacon Bay Crossing, East London' },
  { full_name: 'Johan van der Merwe',role: 'Warehouse Supervisor',    job_title: 'Warehouse Supervisor',     department: 'Warehouse',  job_level: 'Skilled Technical',        gender: 'Male',   race: 'White',    employment_type: 'full_time', salary: 19000, start_date: '2022-04-01', bank_name: 'ABSA',           bank_account_number: '4056123456',  id_number: '8506085800084', phone: '+27 73 444 5566', email: 'johan.vdm@mzansitraders.co.za', emergency_contact_name: 'Marié van der Merwe', emergency_contact_phone: '+27 74 444 5577', address: '9 Bonza Bay Road, Beacon Bay, East London' },
  { full_name: 'Lindiwe Khumalo',    role: 'Sales Team Lead',         job_title: 'Sales Team Lead',          department: 'Retail Floor', job_level: 'Skilled Technical',      gender: 'Female', race: 'African',  employment_type: 'full_time', salary: 17000, start_date: '2022-09-01', bank_name: 'Capitec',        bank_account_number: '1712345678',  id_number: '9312050800085', phone: '+27 84 555 6677', email: 'lindiwe.khumalo@mzansitraders.co.za', emergency_contact_name: 'Zanele Khumalo', emergency_contact_phone: '+27 82 555 6688', address: '31 Amalinda Main Road, East London' },
  { full_name: 'Sipho Ndlovu',       role: 'Sales Assistant',         job_title: 'Sales Assistant',          department: 'Retail Floor', job_level: 'Semi-Skilled',           gender: 'Male',   race: 'African',  employment_type: 'full_time', salary: 9500,  start_date: '2023-02-15', bank_name: 'Capitec',        bank_account_number: '1712345679',  id_number: '9805075800086', phone: '+27 71 666 7788', email: 'sipho.ndlovu@mzansitraders.co.za', emergency_contact_name: 'Thandeka Ndlovu', emergency_contact_phone: '+27 73 666 7799', address: '17 Duncan Village, East London' },
  { full_name: 'Amahle Booysen',     role: 'Cashier',                 job_title: 'Cashier',                  department: 'Retail Floor', job_level: 'Semi-Skilled',           gender: 'Female', race: 'Coloured', employment_type: 'part_time', salary: 7200,  start_date: '2023-05-01', bank_name: 'FNB',            bank_account_number: '62012345602', id_number: '0002280800087', phone: '+27 72 777 8899', email: 'amahle.booysen@mzansitraders.co.za', emergency_contact_name: 'Grant Booysen', emergency_contact_phone: '+27 74 777 8800', address: '3 Southernwood, East London' },
  { full_name: 'Bongani Zulu',       role: 'Delivery Driver',         job_title: 'Delivery Driver',          department: 'Delivery',   job_level: 'Semi-Skilled',            gender: 'Male',   race: 'African',  employment_type: 'full_time', salary: 10500, start_date: '2023-07-10', bank_name: 'Standard Bank',  bank_account_number: '01123456790', id_number: '9106155800088', phone: '+27 82 888 9900', email: 'bongani.zulu@mzansitraders.co.za', emergency_contact_name: 'Nokuthula Zulu', emergency_contact_phone: '+27 83 888 9911', address: '48 Mdantsane NU2, East London' },
  { full_name: 'Grace Adams',        role: 'General Worker / Cleaner',job_title: 'General Worker / Cleaner', department: 'Facilities', job_level: 'Unskilled',              gender: 'Female', race: 'Coloured', employment_type: 'full_time', salary: 6200,  start_date: '2023-08-20', bank_name: 'Capitec',        bank_account_number: '1712345680',  id_number: '9709210800089', phone: '+27 84 999 0011', email: 'grace.adams@mzansitraders.co.za', emergency_contact_name: 'Errol Adams', emergency_contact_phone: '+27 82 999 0022', address: '11 West Bank, East London' },
]

// ─────────────────────────────────────────────────────────────────────────
// 2. CONTACTS — clients / customers
// ─────────────────────────────────────────────────────────────────────────
const CONTACTS = [
  { full_name: 'Nokuthula Mahlangu', company: null, phone: '+27 82 123 4501', email: 'nokuthula.mahlangu@gmail.com', contact_type: 'client', balance_owed: 0,     total_invoiced: 4200,  total_paid: 4200,  tags: ['regular'],  source: 'walk-in',  notes: 'Regular Saturday customer, usually cash.' },
  { full_name: 'Peter Botha',        company: null, phone: '+27 83 123 4502', email: 'peter.botha@webmail.co.za',   contact_type: 'client', balance_owed: 0,     total_invoiced: 3100,  total_paid: 3100,  tags: ['regular'],  source: 'referral', notes: null },
  { full_name: 'Xolani Mgudlwa',     company: 'Sinovuyo Guesthouse',       phone: '+27 71 234 5601', email: 'accounts@sinovuyoguesthouse.co.za', contact_type: 'client', balance_owed: 0,     total_invoiced: 8900,  total_paid: 8900,  tags: ['business','wholesale'], source: 'referral', notes: 'Orders cleaning & household bundles monthly.' },
  { full_name: 'Aisha Adams',        company: null, phone: '+27 72 234 5602', email: 'aisha.adams@gmail.com',       contact_type: 'client', balance_owed: 1610,  total_invoiced: 4025,  total_paid: 2415,  tags: ['new'],      source: 'facebook', notes: null },
  { full_name: 'Themba Nkosi',       company: 'Nkosi Construction Supplies', phone: '+27 73 234 5603', email: 'themba@nkosiconstruction.co.za', contact_type: 'client', balance_owed: 3220,  total_invoiced: 9660,  total_paid: 6440,  tags: ['business','wholesale'], source: 'website', notes: 'Bulk cement & building materials buyer.' },
  { full_name: 'Karen Fourie',       company: null, phone: '+27 84 234 5604', email: 'karen.fourie@outlook.com',    contact_type: 'client', balance_owed: 1035,  total_invoiced: 1035,  total_paid: 0,     tags: ['new'],      source: 'walk-in', notes: null },
  { full_name: 'Bulelani Gqirana',   company: 'Gqirana General Dealer', phone: '+27 82 234 5605', email: 'bulelani@gqiranadealer.co.za', contact_type: 'client', balance_owed: 2185,  total_invoiced: 2185,  total_paid: 0,     tags: ['business'], source: 'referral', notes: 'Resells to Mdantsane spaza shops.' },
  { full_name: 'Michael O’Brien', company: null, phone: '+27 83 234 5606', email: 'michael.obrien@gmail.com',  contact_type: 'client', balance_owed: 920,   total_invoiced: 920,   total_paid: 0,     tags: ['overdue'],  source: 'whatsapp', notes: 'Reminder sent — promised payment end of month.' },
  { full_name: 'Nomvula Sithole',    company: null, phone: '+27 71 234 5607', email: 'nomvula.sithole@gmail.com',   contact_type: 'client', balance_owed: 1580,  total_invoiced: 1580,  total_paid: 0,     tags: ['overdue'],  source: 'whatsapp', notes: null },
  { full_name: 'Riaan Pretorius',    company: 'Pretorius Plumbing', phone: '+27 72 234 5608', email: 'riaan@pretoriusplumbing.co.za', contact_type: 'client', balance_owed: 5980, total_invoiced: 5980,  total_paid: 0,     tags: ['business','in_collections'], source: 'referral', notes: 'Handed to debt recovery — disputes part of the invoice.' },
  { full_name: 'Zandile Mabaso',     company: null, phone: '+27 73 234 5609', email: 'zandile.mabaso@gmail.com',    contact_type: 'client', balance_owed: 0,     total_invoiced: 0,     total_paid: 0,     tags: ['new'],      source: 'walk-in', notes: 'Quote drafted, not yet sent.' },
  { full_name: 'David Naidoo',       company: 'Naidoo Hardware & Tiles', phone: '+27 84 234 5610', email: 'david@naidootiles.co.za', contact_type: 'client', balance_owed: 1725,  total_invoiced: 1725,  total_paid: 0,     tags: ['business'], source: 'website', notes: null },
  { full_name: 'Unknown Walk-in Customer', company: null, phone: null, email: null, contact_type: 'unknown', balance_owed: 0, total_invoiced: 345, total_paid: 345, tags: [], source: 'walk-in', notes: 'Cash sale, no details captured.' },
  { full_name: 'Sipho Radebe',       company: null, phone: '+27 82 234 5611', email: 'sipho.radebe@gmail.com',      contact_type: 'client', balance_owed: 0,     total_invoiced: 1560,  total_paid: 1560,  tags: ['regular'],  source: 'referral', notes: null },
]

// ─────────────────────────────────────────────────────────────────────────
// 3. SUPPLIERS
// ─────────────────────────────────────────────────────────────────────────
const SUPPLIERS = [
  { name: 'Buffalo Cement & Building Supplies', category: 'Building Materials',      phone: '+27 43 700 1010', email: 'sales@buffalocement.co.za',    website: 'https://buffalocement.co.za',    contact_person: 'Werner Kruger',    payment_terms: 30, rating: 4.4, is_community_verified: true,  bbbbee_level: 2, women_owned: false, youth_owned: false, notes: 'Primary cement & aggregate supplier, delivers weekly.' },
  { name: 'EC Paint Distributors',              category: 'Paint & Coatings',        phone: '+27 43 700 1020', email: 'orders@ecpaint.co.za',          website: null,                               contact_person: 'Debbie Swanepoel', payment_terms: 30, rating: 4.1, is_community_verified: false, bbbbee_level: 4, women_owned: true,  youth_owned: false, notes: null },
  { name: 'Khulani Hardware Wholesalers',       category: 'Hardware Wholesale',      phone: '+27 43 700 1030', email: 'info@khulaniwholesale.co.za',  website: 'https://khulaniwholesale.co.za', contact_person: 'Nolitha Mtshali',  payment_terms: 14, rating: 4.7, is_community_verified: true,  bbbbee_level: 1, women_owned: true,  youth_owned: false, notes: 'Best pricing on bulk tool orders.' },
  { name: 'Steeltech Fabrication',              category: 'Steel & Fabrication',     phone: '+27 43 700 1040', email: 'quotes@steeltech.co.za',        website: null,                               contact_person: 'Andre Nel',        payment_terms: 30, rating: 3.9, is_community_verified: false, bbbbee_level: 3, women_owned: false, youth_owned: false, notes: 'Custom security gates and burglar bars.' },
  { name: 'GreenClean Supplies',                category: 'Cleaning Supplies',       phone: '+27 43 700 1050', email: 'hello@greenclean.co.za',        website: 'https://greenclean.co.za',       contact_person: 'Asanda Mfeka',     payment_terms: 7,  rating: 4.3, is_community_verified: true,  bbbbee_level: 5, women_owned: false, youth_owned: true,  notes: null },
  { name: 'Amatola Electrical Wholesalers',     category: 'Electrical',              phone: '+27 43 700 1060', email: 'sales@amatolaelectrical.co.za', website: null,                               contact_person: 'Kevin Adams',      payment_terms: 30, rating: 4.0, is_community_verified: false, bbbbee_level: 2, women_owned: false, youth_owned: false, notes: null },
  { name: 'Coastal Plumbing Supplies',          category: 'Plumbing',                phone: '+27 43 700 1070', email: 'orders@coastalplumbing.co.za',  website: null,                               contact_person: 'Fezeka Dyantyi',   payment_terms: 30, rating: 3.8, is_community_verified: false, bbbbee_level: 6, women_owned: false, youth_owned: false, notes: null },
  { name: 'Border Packaging & Stationery',      category: 'Packaging & Stationery',  phone: '+27 43 700 1080', email: 'info@borderpack.co.za',         website: null,                               contact_person: 'Melissa Jacobs',   payment_terms: 30, rating: 3.6, is_community_verified: false, bbbbee_level: null, women_owned: true, youth_owned: false, notes: 'Rating not yet fully confirmed with all branches.' },
  { name: 'Fast Freight Logistics EC',          category: 'Logistics & Delivery',    phone: '+27 43 700 1090', email: 'dispatch@fastfreightec.co.za',  website: 'https://fastfreightec.co.za',    contact_person: 'Luvo Matiwane',    payment_terms: 14, rating: 4.2, is_community_verified: true,  bbbbee_level: 4, women_owned: false, youth_owned: true,  notes: 'Handles overflow deliveries when our own van is booked.' },
]

// ─────────────────────────────────────────────────────────────────────────
// 4. PRODUCTS (inventory)
// ─────────────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { name: 'Cement 50kg (Surebuild)',        sku: 'CEM-50',        category: 'Building Materials', unit_price: 115,  cost_price: 92,  current_stock: 340, reorder_level: 100, reorder_quantity: 300, unit: 'bag' },
  { name: 'PVA Paint White 20L',            sku: 'PNT-PVA20W',    category: 'Paint',               unit_price: 780,  cost_price: 610, current_stock: 22,  reorder_level: 15,  reorder_quantity: 30,  unit: 'unit' },
  { name: 'Security Gate — Standard',       sku: 'SEC-GATE-STD',  category: 'Security',            unit_price: 1450, cost_price: 1050,current_stock: 8,   reorder_level: 5,   reorder_quantity: 10,  unit: 'unit' },
  { name: 'Garden Tool Set (5-Piece)',      sku: 'GDN-TOOL5',     category: 'Garden',               unit_price: 349,  cost_price: 240, current_stock: 40,  reorder_level: 10,  reorder_quantity: 25,  unit: 'set' },
  { name: 'Electrical Cable 2.5mm (100m)',  sku: 'ELEC-CBL25',    category: 'Electrical',          unit_price: 890,  cost_price: 700, current_stock: 12,  reorder_level: 10,  reorder_quantity: 20,  unit: 'roll' },
  { name: 'PVC Pipe 110mm (6m length)',     sku: 'PLM-PVC110',    category: 'Plumbing',            unit_price: 245,  cost_price: 180, current_stock: 60,  reorder_level: 20,  reorder_quantity: 40,  unit: 'length' },
  { name: 'Tool Kit — 120 Piece',           sku: 'TLK-120',       category: 'Tools',                unit_price: 999,  cost_price: 720, current_stock: 15,  reorder_level: 8,   reorder_quantity: 15,  unit: 'kit' },
  { name: 'IBR Roofing Sheet (3m)',         sku: 'ROOF-IBR3',     category: 'Roofing',              unit_price: 320,  cost_price: 260, current_stock: 4,   reorder_level: 10,  reorder_quantity: 40,  unit: 'sheet' },
  { name: 'Household Cleaning Bundle',      sku: 'HH-CLEAN-B',    category: 'Household',            unit_price: 189,  cost_price: 130, current_stock: 55,  reorder_level: 20,  reorder_quantity: 40,  unit: 'bundle' },
  { name: 'Braai Grill Deluxe',             sku: 'BRAAI-DLX',     category: 'Outdoor',              unit_price: 1250, cost_price: 890, current_stock: 6,   reorder_level: 5,   reorder_quantity: 10,  unit: 'unit' },
  { name: 'Wheelbarrow Heavy Duty',         sku: 'WB-HD',         category: 'Garden',                unit_price: 899,  cost_price: 650, current_stock: 9,   reorder_level: 6,   reorder_quantity: 12,  unit: 'unit' },
  { name: 'Cable Ties Assorted (100pk)',    sku: 'ELEC-CT100',    category: 'Electrical',          unit_price: 65,   cost_price: 38,  current_stock: 200, reorder_level: 50,  reorder_quantity: 150, unit: 'pack' },
  { name: 'Steel Padlock Heavy Duty',       sku: 'SEC-LOCK-HD',   category: 'Security',              unit_price: 145,  cost_price: 95,  current_stock: 3,   reorder_level: 15,  reorder_quantity: 40,  unit: 'unit' },
  { name: 'Work Gloves — Leather (pair)',   sku: 'PPE-GLV-L',     category: 'Safety / PPE',         unit_price: 89,   cost_price: 55,  current_stock: 120, reorder_level: 40,  reorder_quantity: 100, unit: 'pair' },
]

// ─────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding demo data for tenant ${TENANT_ID} (Mzansi Test Traders)\n`)

  // 1. Staff
  await seedIfEmpty('staff', STAFF.map(s => ({ tenant_id: T(), active: true, leave_balance: 15, leave_taken: 0, ...s })))
  const staffFull = await pgSelect('staff', 'id,full_name')
  const sid = (name) => staffFull.find(s => s.full_name === name)?.id ?? null

  // 2. Contacts
  await seedIfEmpty('contacts', CONTACTS.map(c => ({ tenant_id: T(), popia_consent: true, popia_consent_at: iso(daysAgo(60)), ...c })))
  const contactsFull = await pgSelect('contacts', 'id,full_name')
  const cid = (name) => contactsFull.find(c => c.full_name === name)?.id ?? null

  // 3. Suppliers
  await seedIfEmpty('suppliers', SUPPLIERS.map(s => ({ tenant_id: T(), ...s })))

  // 4. Products
  await seedIfEmpty('products', PRODUCTS.map(p => ({ tenant_id: T(), active: true, ...p })))
  const productsFull = await pgSelect('products', 'id,name,sku')
  const pid = (sku) => productsFull.find(p => p.sku === sku)?.id ?? null

  // 5. Inventory transactions
  const invTxBefore = await count('inventory_transactions')
  if (invTxBefore === 0 && productsFull.length > 0) {
    const txRows = []
    const stockMoves = [
      ['CEM-50', 'receive', 400, 45], ['CEM-50', 'sell', -60, 10],
      ['PNT-PVA20W', 'receive', 30, 40], ['PNT-PVA20W', 'sell', -8, 5],
      ['SEC-GATE-STD', 'receive', 10, 50], ['SEC-GATE-STD', 'sell', -2, 8],
      ['GDN-TOOL5', 'receive', 50, 35], ['GDN-TOOL5', 'sell', -10, 4],
      ['ROOF-IBR3', 'receive', 20, 55], ['ROOF-IBR3', 'sell', -16, 6],
      ['SEC-LOCK-HD', 'receive', 20, 55], ['SEC-LOCK-HD', 'sell', -17, 3],
      ['HH-CLEAN-B', 'receive', 60, 20], ['HH-CLEAN-B', 'sell', -5, 2],
      ['ELEC-CBL25', 'receive', 15, 30], ['ELEC-CBL25', 'sell', -3, 7],
    ]
    for (const [sku, type, qty, agoDays] of stockMoves) {
      const productId = pid(sku)
      if (!productId) continue
      txRows.push({
        tenant_id: T(), product_id: productId, transaction_type: type, quantity: qty,
        unit_cost: type === 'receive' ? (productsFull.find(p => p.sku === sku)?.cost_price ?? null) : null,
        reference: type === 'receive' ? `GRN-${sku}-${agoDays}` : `SALE-${sku}-${agoDays}`,
        notes: type === 'receive' ? 'Stock received from supplier' : 'Sold over the counter',
        created_by: OWNER_ID, created_at: iso(daysAgo(agoDays)),
      })
    }
    await pgInsert('inventory_transactions', txRows)
    log('inventory_transactions', invTxBefore, await count('inventory_transactions'))
  } else {
    log('inventory_transactions', invTxBefore, invTxBefore)
  }

  // 6. Invoices
  function lineItems(items) {
    let subtotal = 0, vat = 0
    const withTotals = items.map(it => {
      const lineSubtotal = it.quantity * it.unitPrice
      const lineVat = lineSubtotal * 0.15
      subtotal += lineSubtotal; vat += lineVat
      return { description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, vatRate: 0.15, line_subtotal: lineSubtotal, line_vat: lineVat }
    })
    return { items: withTotals, subtotal: Math.round(subtotal * 100) / 100, vat: Math.round(vat * 100) / 100, total: Math.round((subtotal + vat) * 100) / 100 }
  }

  const invoiceDefs = [
    { contact: 'Nokuthula Mahlangu', items: [{ description: 'Household Cleaning Bundle', quantity: 4, unitPrice: 189 }, { description: 'Work Gloves — Leather (pair)', quantity: 6, unitPrice: 89 }], dueAgo: 55, status: 'paid', paidAgo: 50 },
    { contact: 'Peter Botha',        items: [{ description: 'PVC Pipe 110mm (6m length)', quantity: 8, unitPrice: 245 }], dueAgo: 48, status: 'paid', paidAgo: 44 },
    { contact: 'Xolani Mgudlwa',     items: [{ description: 'Household Cleaning Bundle', quantity: 20, unitPrice: 189 }, { description: 'Work Gloves — Leather (pair)', quantity: 10, unitPrice: 89 }], dueAgo: 40, status: 'paid', paidAgo: 36 },
    { contact: 'Aisha Adams',        items: [{ description: 'Braai Grill Deluxe', quantity: 1, unitPrice: 1250 }, { description: 'Cable Ties Assorted (100pk)', quantity: 5, unitPrice: 65 }], dueAgo: 35, status: 'partial', paidPortion: 0.6 },
    { contact: 'Themba Nkosi',       items: [{ description: 'Cement 50kg (Surebuild)', quantity: 60, unitPrice: 115 }], dueAgo: 20, status: 'partial', paidPortion: 0.35 },
    { contact: 'Karen Fourie',       items: [{ description: 'PVA Paint White 20L', quantity: 1, unitPrice: 780 }, { description: 'Garden Tool Set (5-Piece)', quantity: 1, unitPrice: 349 }], dueAgo: -10, status: 'unpaid' },
    { contact: 'Bulelani Gqirana',   items: [{ description: 'Tool Kit — 120 Piece', quantity: 1, unitPrice: 999 }, { description: 'Wheelbarrow Heavy Duty', quantity: 1, unitPrice: 899 }], dueAgo: -20, status: 'unpaid' },
    { contact: 'Michael O’Brien', items: [{ description: 'Electrical Cable 2.5mm (100m)', quantity: 1, unitPrice: 890 }], dueAgo: 15, status: 'overdue', escalation: 2 },
    { contact: 'Nomvula Sithole',    items: [{ description: 'Security Gate — Standard', quantity: 1, unitPrice: 1450 }], dueAgo: 25, status: 'overdue', escalation: 3 },
    { contact: 'Riaan Pretorius',    items: [{ description: 'PVC Pipe 110mm (6m length)', quantity: 15, unitPrice: 245 }, { description: 'Steel Padlock Heavy Duty', quantity: 8, unitPrice: 145 }], dueAgo: 62, status: 'in_collections', escalation: 5, recoveryStatus: 'awaiting_owner_review' },
    { contact: 'Zandile Mabaso',     items: [{ description: 'Cement 50kg (Surebuild)', quantity: 10, unitPrice: 115 }], dueAgo: -30, status: 'draft', createdAgo: 3 },
    { contact: 'David Naidoo',       items: [{ description: 'IBR Roofing Sheet (3m)', quantity: 12, unitPrice: 320 }], dueAgo: -14, status: 'sent', createdAgo: 2, sentAgo: 2 },
    { contact: 'Sipho Radebe',       items: [{ description: 'Household Cleaning Bundle', quantity: 6, unitPrice: 189 }, { description: 'Cable Ties Assorted (100pk)', quantity: 4, unitPrice: 65 }], dueAgo: 8, status: 'paid', paidAgo: 6 },
    { contact: 'Unknown Walk-in Customer', items: [{ description: 'Work Gloves — Leather (pair)', quantity: 2, unitPrice: 89 }, { description: 'Cable Ties Assorted (100pk)', quantity: 1, unitPrice: 65 }], dueAgo: 0, status: 'paid', paidAgo: 0, createdAgo: 0 },
  ]

  const invBefore = await count('invoices')
  if (invBefore === 0) {
    const invoiceRows = invoiceDefs.map((def, i) => {
      const { items: lineItemRows, subtotal, vat, total } = lineItems(def.items)
      const contactId = cid(def.contact)
      const sourceContact = CONTACTS.find(c => c.full_name === def.contact)
      const createdAgo = def.createdAgo ?? (def.dueAgo >= 0 ? def.dueAgo + 30 : Math.max(1, -def.dueAgo - 20))
      let amountPaid = 0
      if (def.status === 'paid') amountPaid = total
      else if (def.status === 'partial') amountPaid = Math.round(total * (def.paidPortion ?? 0.5) * 100) / 100

      return {
        tenant_id: T(),
        contact_id: contactId,
        contact_name: def.contact,
        contact_phone: sourceContact?.phone ?? null,
        contact_email: sourceContact?.email ?? null,
        invoice_number: `INV-${isoD(daysAgo(createdAgo)).replace(/-/g, '')}-${String(1000 + i)}`,
        line_items: lineItemRows,
        subtotal, vat_amount: vat, total, amount: total,
        amount_paid: amountPaid, amount_due: Math.round((total - amountPaid) * 100) / 100,
        currency: 'ZAR',
        due_date: isoD(daysAgo(def.dueAgo)),
        status: def.status,
        escalation_level: def.escalation ?? 0,
        recovery_status: def.recoveryStatus ?? null,
        notes: def.status === 'in_collections' ? 'Customer disputes part of the delivery charge — awaiting owner review before further escalation.' : null,
        reference: null,
        sent_at: def.status === 'draft' ? null : iso(daysAgo(def.sentAgo ?? createdAgo)),
        paid_at: def.status === 'paid' ? iso(daysAgo(def.paidAgo ?? 0)) : null,
        created_by: OWNER_ID,
        created_at: iso(daysAgo(createdAgo)),
      }
    })
    await pgInsert('invoices', invoiceRows)
    log('invoices', invBefore, await count('invoices'))
  } else {
    log('invoices', invBefore, invBefore)
  }

  // 7. Expenses
  const expenseDefs = [
    { staff: 'Nomsa Dlamini', amount: 1250, category: 'stock purchase', description: 'Emergency top-up of padlocks from local wholesaler', status: 'paid', ago: 40 },
    { staff: 'Bongani Zulu',  amount: 680,  category: 'fuel',           description: 'Diesel for delivery van — Mdantsane & Beacon Bay run', status: 'paid', ago: 33 },
    { staff: 'Johan van der Merwe', amount: 420, category: 'maintenance', description: 'Forklift service and hydraulic fluid top-up', status: 'approved', ago: 21 },
    { staff: 'Priya Naidoo',  amount: 950,  category: 'utilities',      description: 'Generator diesel during load-shedding stage 4', status: 'paid', ago: 18 },
    { staff: 'Lindiwe Khumalo', amount: 210, category: 'marketing',    description: 'Printed flyers for weekend hardware sale', status: 'approved', ago: 15 },
    { staff: 'Bongani Zulu',  amount: 540,  category: 'fuel',           description: 'Fuel — bulk cement delivery to Nkosi Construction', status: 'pending', ago: 9 },
    { staff: 'Grace Adams',   amount: 180,  category: 'stationery',    description: 'Cleaning supplies for staff facilities', status: 'pending', ago: 6 },
    { staff: 'Sipho Ndlovu',  amount: 95,   category: 'meals',          description: 'Refreshments for stock-take overtime shift', status: 'rejected', ago: 12 },
    { staff: 'Nomsa Dlamini', amount: 3200, category: 'stock purchase', description: 'Top-up order — paint and roofing sheets ahead of month-end rush', status: 'paid', ago: 27 },
    { staff: 'Johan van der Merwe', amount: 310, category: 'travel',   description: 'Trip to Khulani Wholesalers to inspect bulk tool kit order', status: 'approved', ago: 3 },
  ]
  const expBefore = await count('expenses')
  if (expBefore === 0) {
    const rows = expenseDefs.map(e => ({
      tenant_id: T(), staff_id: sid(e.staff), amount: e.amount, category: e.category, description: e.description,
      status: e.status, submitted_at: iso(daysAgo(e.ago)),
      approved_by: ['approved', 'paid'].includes(e.status) ? OWNER_ID : null,
      approved_at: ['approved', 'paid'].includes(e.status) ? iso(daysAgo(e.ago - 1)) : null,
      paid_at: e.status === 'paid' ? iso(daysAgo(Math.max(0, e.ago - 3))) : null,
      created_at: iso(daysAgo(e.ago)),
    }))
    await pgInsert('expenses', rows)
    log('expenses', expBefore, await count('expenses'))
  } else log('expenses', expBefore, expBefore)

  // 8. Contracts
  const contractDefs = [
    { title: 'Corporate Supply Agreement — Nkosi Construction Supplies', contact: 'Themba Nkosi', type: 'supply_agreement', status: 'signed', value: 120000, startAgo: 200, endAhead: 165, autoRenew: true, signedAgo: 195 },
    { title: 'Guesthouse Maintenance & Supply Contract', contact: 'Xolani Mgudlwa', type: 'service_agreement', status: 'signed', value: 36000, startAgo: 90, endAhead: 275, autoRenew: true, signedAgo: 88 },
    { title: 'Retail Premises Lease — Vincent, East London', contact: null, type: 'lease', status: 'signed', value: 480000, startAgo: 400, endAhead: 330, autoRenew: false, signedAgo: 398 },
    { title: 'Delivery Services Agreement — Fast Freight Logistics EC', contact: null, type: 'service_agreement', status: 'partially_signed', value: 60000, startAgo: 10, endAhead: 355, autoRenew: true, signedAgo: null },
    { title: 'POS System & Card Machine Service Agreement', contact: null, type: 'service_agreement', status: 'sent', value: 18000, startAgo: null, endAhead: null, autoRenew: true, signedAgo: null },
    { title: 'NDA — Prospective Franchise Investor', contact: null, type: 'nda', status: 'draft', value: null, startAgo: null, endAhead: null, autoRenew: false, signedAgo: null },
    { title: 'Bulk Supply Agreement — Gqirana General Dealer (lapsed)', contact: 'Bulelani Gqirana', type: 'supply_agreement', status: 'expired', value: 45000, startAgo: 420, endAhead: -30, autoRenew: false, signedAgo: 415 },
  ]
  const conBefore = await count('contracts')
  if (conBefore === 0) {
    const rows = contractDefs.map(c => ({
      tenant_id: T(), contact_id: c.contact ? cid(c.contact) : null, title: c.title, contract_type: c.type,
      content: { summary: c.title, generated_by: 'demo-seed' }, status: c.status, value: c.value,
      start_date: c.startAgo !== null ? isoD(daysAgo(c.startAgo)) : null,
      end_date: c.endAhead !== null ? isoD(daysAhead(c.endAhead)) : null,
      auto_renew: c.autoRenew, signed_at: c.signedAgo !== null ? iso(daysAgo(c.signedAgo)) : null,
      created_by: OWNER_ID, created_at: iso(daysAgo((c.startAgo ?? 5) + 2)),
    }))
    await pgInsert('contracts', rows)
    log('contracts', conBefore, await count('contracts'))
  } else log('contracts', conBefore, conBefore)

  // 9. Booking services + bookings
  const svcBefore = await count('booking_services')
  let services = []
  if (svcBefore === 0) {
    const svcRows = [
      { tenant_id: T(), name: 'Delivery Slot — Local', description: 'Scheduled local delivery within East London', duration_minutes: 60, price: 150, buffer_minutes: 15, max_bookings_per_slot: 2, staff_ids: [sid('Bongani Zulu')].filter(Boolean), colour: '#3B82F6', active: true },
      { tenant_id: T(), name: 'Bulk Order Collection', description: 'Customer collects a pre-packed bulk order', duration_minutes: 30, price: 0, buffer_minutes: 10, max_bookings_per_slot: 3, staff_ids: [sid('Sipho Ndlovu')].filter(Boolean), colour: '#22C55E', active: true },
      { tenant_id: T(), name: 'Stock Consultation', description: 'In-store consultation for a large trade order', duration_minutes: 45, price: 0, buffer_minutes: 15, max_bookings_per_slot: 1, staff_ids: [sid('Nomsa Dlamini')].filter(Boolean), colour: '#F59E0B', active: true },
    ]
    services = await pgInsert('booking_services', svcRows)
    log('booking_services', svcBefore, await count('booking_services'))
  } else {
    services = await pgSelect('booking_services', 'id,name')
    log('booking_services', svcBefore, svcBefore)
  }
  const svcId = (name) => services.find(s => s.name === name)?.id ?? null

  const bookingDefs = [
    { contact: 'Nokuthula Mahlangu', service: 'Delivery Slot — Local', staff: 'Bongani Zulu', ago: 30, status: 'completed', source: 'manual' },
    { contact: 'Xolani Mgudlwa',     service: 'Delivery Slot — Local', staff: 'Bongani Zulu', ago: 22, status: 'completed', source: 'whatsapp' },
    { contact: 'Themba Nkosi',       service: 'Bulk Order Collection', staff: 'Sipho Ndlovu', ago: 18, status: 'completed', source: 'manual' },
    { contact: 'Peter Botha',        service: 'Delivery Slot — Local', staff: 'Bongani Zulu', ago: 10, status: 'no_show', source: 'whatsapp' },
    { contact: 'David Naidoo',       service: 'Stock Consultation',    staff: 'Nomsa Dlamini', ago: 6,  status: 'completed', source: 'portal' },
    { contact: 'Bulelani Gqirana',   service: 'Bulk Order Collection', staff: 'Sipho Ndlovu', ago: 2,  status: 'cancelled', source: 'manual' },
    { contact: 'Karen Fourie',       service: 'Delivery Slot — Local', staff: 'Bongani Zulu', ago: -1, status: 'confirmed', source: 'whatsapp' },
    { contact: 'Aisha Adams',        service: 'Bulk Order Collection', staff: 'Sipho Ndlovu', ago: -3, status: 'confirmed', source: 'manual' },
    { contact: 'Riaan Pretorius',    service: 'Stock Consultation',    staff: 'Nomsa Dlamini', ago: -5, status: 'pending', source: 'portal' },
    { contact: 'Sipho Radebe',       service: 'Delivery Slot — Local', staff: 'Bongani Zulu', ago: -8, status: 'confirmed', source: 'widget' },
  ]
  const bkBefore = await count('bookings')
  if (bkBefore === 0) {
    const rows = bookingDefs.map(b => {
      const start = daysAgo(b.ago, 10, 0)
      const end = new Date(start); end.setMinutes(end.getMinutes() + 60)
      return {
        tenant_id: T(), service_id: svcId(b.service), contact_id: cid(b.contact), staff_id: sid(b.staff),
        start_at: iso(start), end_at: iso(end), status: b.status,
        notes: null, reminder_sent_at: b.ago > 0 ? iso(daysAgo(b.ago + 1)) : null,
        cancelled_reason: b.status === 'cancelled' ? 'Customer rescheduled to next week' : null,
        source: b.source, created_at: iso(daysAgo(b.ago + 3)),
      }
    })
    await pgInsert('bookings', rows)
    log('bookings', bkBefore, await count('bookings'))
  } else log('bookings', bkBefore, bkBefore)

  // 10. Tasks
  const invoicesFull = await pgSelect('invoices', 'id,contact_name,status')
  const invIdByContact = (name) => invoicesFull.find(i => i.contact_name === name)?.id ?? null

  const taskDefs = [
    { title: 'Chase overdue invoice — Michael O’Brien', description: 'Send WhatsApp reminder for overdue balance', status: 'in_progress', priority: 'high', source: 'agent_chase', dueAgo: -1, invoice: 'Michael O’Brien' },
    { title: 'Chase overdue invoice — Nomvula Sithole', description: 'Second reminder — 25 days overdue', status: 'todo', priority: 'high', source: 'agent_chase', dueAgo: -2, invoice: 'Nomvula Sithole' },
    { title: 'Owner review — Pretorius Plumbing collections case', description: 'Escalation drafted, needs owner sign-off before sending', status: 'review', priority: 'urgent', source: 'agent_chase', dueAgo: -1, invoice: 'Riaan Pretorius' },
    { title: 'Reorder security padlocks (below reorder level)', description: 'Stock at 3 units, reorder level is 15 — order from Khulani Wholesalers', status: 'todo', priority: 'urgent', source: 'manual', dueAgo: -2 },
    { title: 'Reorder IBR roofing sheets', description: 'Stock at 4 units, reorder level is 10', status: 'todo', priority: 'high', source: 'manual', dueAgo: -3 },
    { title: 'Renew Fire Safety Certificate', description: 'Expires in under 30 days — book municipal inspection', status: 'todo', priority: 'high', source: 'document_expiry', dueAgo: -20 },
    { title: 'Renew PrDP — Bongani Zulu', description: 'Professional driving permit expiring soon', status: 'todo', priority: 'medium', source: 'document_expiry', dueAgo: -10 },
    { title: 'Prepare EMP201 for July', description: 'Monthly PAYE/UIF/SDL submission to SARS', status: 'done', priority: 'medium', source: 'agent_compliance', dueAgo: 25, completedAgo: 26 },
    { title: 'Sign delivery services agreement', description: 'Fast Freight Logistics contract awaiting second signature', status: 'in_progress', priority: 'medium', source: 'manual', dueAgo: -6 },
    { title: 'Onboard Grace Adams — facilities role', description: 'Complete onboarding checklist and issue uniform', status: 'done', priority: 'low', source: 'onboarding', dueAgo: 350, completedAgo: 352 },
    { title: 'Quarterly stock count — hardware aisle', description: 'Full physical count against system stock', status: 'todo', priority: 'medium', source: 'manual', dueAgo: -14 },
    { title: 'Follow up quote — Zandile Mabaso', description: 'Draft invoice was never sent — confirm still interested', status: 'todo', priority: 'low', source: 'manual', dueAgo: -4 },
    { title: 'Review Q3 goals progress with team', description: 'Mid-quarter check-in on revenue and inventory goals', status: 'cancelled', priority: 'low', source: 'manual', dueAgo: 5 },
  ]
  const taskBefore = await count('tasks')
  if (taskBefore === 0) {
    const rows = taskDefs.map(t => ({
      tenant_id: T(), project_id: null, contact_id: null, invoice_id: t.invoice ? invIdByContact(t.invoice) : null, document_id: null,
      title: t.title, description: t.description, assigned_to: OWNER_ID, status: t.status, priority: t.priority,
      due_date: iso(daysAgo(t.dueAgo)), source: t.source, created_by: OWNER_ID,
      completed_at: t.completedAgo !== undefined ? iso(daysAgo(t.completedAgo)) : (t.status === 'done' ? iso(daysAgo(Math.max(0, t.dueAgo - 1))) : null),
      created_at: iso(daysAgo(Math.max(t.dueAgo, 0) + 5)),
    }))
    await pgInsert('tasks', rows)
    log('tasks', taskBefore, await count('tasks'))
  } else log('tasks', taskBefore, taskBefore)

  // 11. Goals
  const goalDefs = [
    { title: 'Grow monthly revenue to R180,000', description: 'Increase average monthly sales through wholesale accounts', quarter: 'Q3 2026', metric: 'Monthly revenue (ZAR)', current: 142000, target: 180000, status: 'active' },
    { title: 'Sign 5 new wholesale trade accounts', description: 'Target construction and guesthouse trade in East London', quarter: 'Q3 2026', metric: 'New trade accounts', current: 3, target: 5, status: 'active' },
    { title: 'Reduce average debtor days below 30', description: 'Tighten invoice follow-up cadence via AdminOS recovery agent', quarter: 'Q3 2026', metric: 'Average debtor days', current: 38, target: 30, status: 'active' },
    { title: 'Cut stockouts on top 20 SKUs to zero', description: 'Better reorder-point discipline on fast movers', quarter: 'Q3 2026', metric: 'Stockout incidents', current: 4, target: 0, status: 'active' },
    { title: 'Complete Employment Equity plan for 2026', description: 'Submit EE data ahead of the September deadline', quarter: 'Q3 2026', metric: 'EE plan status', current: 1, target: 1, status: 'achieved' },
    { title: 'Open second till point for weekends', description: 'Reduce Saturday queue times during peak trade', quarter: 'Q2 2026', metric: 'Avg. checkout wait (min)', current: 6, target: 3, status: 'missed' },
    { title: 'Launch WhatsApp order-ahead for regulars', description: 'Let repeat trade customers order via WhatsApp for collection', quarter: 'Q2 2026', metric: 'Orders via WhatsApp', current: 60, target: 50, status: 'achieved' },
  ]
  const goalBefore = await count('goals')
  if (goalBefore === 0) {
    const rows = goalDefs.map(g => ({ tenant_id: T(), title: g.title, description: g.description, quarter: g.quarter, target_metric: g.metric, current_value: g.current, target_value: g.target, status: g.status }))
    await pgInsert('goals', rows)
    log('goals', goalBefore, await count('goals'))
  } else log('goals', goalBefore, goalBefore)

  // 12. Professional licences & permits
  const licenceDefs = [
    { type: 'Business Trading Licence', staff: null, body: 'Buffalo City Metro Municipality', num: 'BCM-TRD-004521', issueAgo: 900, expiryAhead: 200, reminderDays: 60 },
    { type: 'Fire Safety Certificate', staff: null, body: 'Buffalo City Fire Department', num: 'BCFD-FSC-2024-1187', issueAgo: 340, expiryAhead: 25, reminderDays: 60 },
    { type: 'Forklift Operator Licence', staff: 'Johan van der Merwe', body: 'TETA', num: 'TETA-FL-88213', issueAgo: 500, expiryAhead: 400, reminderDays: 60 },
    { type: 'Professional Driving Permit (PrDP)', staff: 'Bongani Zulu', body: 'Department of Transport', num: 'PRDP-EC-551029', issueAgo: 1810, expiryAhead: 10, reminderDays: 60 },
    { type: 'Health & Safety Compliance Certificate (OHS Act)', staff: null, body: 'Department of Employment and Labour', num: 'DEL-OHS-33920', issueAgo: 400, expiryAhead: -15, reminderDays: 60 },
    { type: 'Weighbridge / Scale Calibration Certificate', staff: null, body: 'SANAS', num: 'SANAS-CAL-77104', issueAgo: 60, expiryAhead: 300, reminderDays: 45 },
  ]
  const licBefore = await count('professional_licenses')
  if (licBefore === 0) {
    const rows = licenceDefs.map(l => ({
      tenant_id: T(), staff_id: l.staff ? sid(l.staff) : null, license_type: l.type, license_number: l.num,
      issuing_body: l.body, issue_date: isoD(daysAgo(l.issueAgo)), expiry_date: isoD(daysAhead(l.expiryAhead)),
      document_id: null, renewal_reminder_days: l.reminderDays,
    }))
    await pgInsert('professional_licenses', rows)
    log('professional_licenses', licBefore, await count('professional_licenses'))
  } else log('professional_licenses', licBefore, licBefore)

  // 13. Documents (metadata only — no real files)
  const documentDefs = [
    { name: '2026-Business-Strategy.pdf', type: 'pdf', category: 'strategy', summary: 'Three-year growth plan targeting wholesale trade accounts across Buffalo City.' },
    { name: 'EMP201-July2026.pdf', type: 'pdf', category: 'compliance', summary: 'Monthly PAYE, UIF and SDL submission for July 2026.' },
    { name: 'Supplier-Agreement-Buffalo-Cement.docx', type: 'docx', category: 'contract', summary: 'Signed supply terms with Buffalo Cement & Building Supplies.' },
    { name: 'Q2-2026-Financial-Report.xlsx', type: 'xlsx', category: 'report', summary: 'Quarterly management accounts — revenue, margin and expense breakdown.' },
    { name: 'Staff-Handbook-2026.pdf', type: 'pdf', category: 'hr', summary: 'Employee handbook covering leave, conduct and safety policy.' },
    { name: 'Fire-Safety-Certificate.pdf', type: 'pdf', category: 'compliance', summary: 'Municipal fire safety compliance certificate, expiring soon.', expiryAhead: 25 },
    { name: 'Invoice-Backup-June2026.csv', type: 'csv', category: 'invoice', summary: 'Exported invoice ledger for June 2026.' },
    { name: 'Store-Floor-Layout.jpg', type: 'image', category: 'other', summary: 'Current retail floor layout photo for insurance records.' },
    { name: 'Lease-Agreement-Premises.pdf', type: 'pdf', category: 'contract', summary: 'Retail premises lease, Vincent, East London.' },
    { name: 'COIDA-Return-2026.pdf', type: 'pdf', category: 'compliance', summary: 'Annual Return of Earnings (W.As.8) to the Compensation Fund.' },
    { name: 'Employment-Equity-Plan-2026.docx', type: 'docx', category: 'hr', summary: 'EE plan and targets submitted for the 2026 reporting year.' },
  ]
  const docBefore = await count('documents')
  if (docBefore === 0) {
    const rows = documentDefs.map((d, i) => ({
      tenant_id: T(), original_filename: d.name, file_type: d.type, doc_category: d.category,
      storage_url: `${TENANT_ID}/documents/${d.name}`, extracted_text: null, ai_summary: d.summary,
      extracted_goals: null, processing_status: i === documentDefs.length - 1 ? 'processing' : 'done',
      uploaded_by: OWNER_ID, document_type: d.category, expiry_date: d.expiryAhead ? isoD(daysAhead(d.expiryAhead)) : null,
      is_reference: false, created_at: iso(daysAgo(60 - i * 4)),
    }))
    try {
      await pgInsert('documents', rows)
      log('documents', docBefore, await count('documents'))
    } catch (e) {
      // KNOWN PRODUCTION BUG, not caused by this script: trg_document_processing
      // (AFTER INSERT ON documents -> fn_trigger_doc_pipeline()) unconditionally
      // reads NEW.status, a column that does not exist on `documents` (the real
      // column is `processing_status`) — so this trigger throws
      // 42703 "record \"new\" has no field \"status\"" on EVERY insert into
      // documents, for every tenant, not just this seed. Flagging rather than
      // patching the trigger, which is outside a data-seed script's scope.
      report.push({ table: 'documents', before: docBefore, after: `SKIPPED — blocked by production bug: ${e.message}` })
      console.error(`  documents: SKIPPED — blocked by a pre-existing production bug (trg_document_processing reads a non-existent "status" column). ${e.message}`)
    }
  } else log('documents', docBefore, docBefore)

  // 14. Safety incidents
  const incidentDefs = [
    { type: 'near_miss', staff: 'Bongani Zulu', ago: 45, desc: 'Delivery van reversed close to a customer in the loading bay — no contact made.', location: 'Loading bay', immediate: 'Driver briefed on reversing procedure, spotter now required.', root: 'No designated spotter during reversing.', corrective: 'Mandatory spotter policy added to delivery SOP.' },
    { type: 'minor_injury', staff: 'Grace Adams', ago: 38, desc: 'Slipped on a wet floor near the entrance during rain, minor bruise to elbow.', location: 'Store entrance', immediate: 'First aid applied, wet floor signage placed immediately.', root: 'No wet-floor signage during rain.', corrective: 'Wet-floor signs now placed at entrance whenever it rains.' },
    { type: 'property_damage', staff: 'Johan van der Merwe', ago: 29, desc: 'Forklift clipped a warehouse shelf, damaging stored roofing sheets.', location: 'Warehouse — aisle 3', immediate: 'Forklift operation paused, area cordoned off.', root: 'Aisle width too narrow for current forklift turning radius.', corrective: 'Aisle 3 shelving being widened; forklift refresher training scheduled.' },
    { type: 'near_miss', staff: 'Sipho Ndlovu', ago: 20, desc: 'Stack of cement bags nearly toppled while being loaded onto a trolley.', location: 'Building materials aisle', immediate: 'Stack rebuilt to correct height, staff reminded of max stack height.', root: 'Stack exceeded recommended height.', corrective: 'Max stack height signage added to aisle.' },
    { type: 'minor_injury', staff: 'Amahle Booysen', ago: 12, desc: 'Small cut to finger while opening a delivery box with a box cutter.', location: 'Till point / receiving area', immediate: 'Wound cleaned and dressed from first aid kit.', root: 'Box cutter blade was overextended.', corrective: 'Safety box cutters issued to all till staff.' },
    { type: 'environmental', staff: null, ago: 6, desc: 'Small paint spill during offloading — approximately 2L of PVA paint spilled onto the yard surface.', location: 'Delivery yard', immediate: 'Spill contained with sand, area cleaned per SDS guidance.', root: 'Tin was not properly sealed before offloading.', corrective: 'Offloading checklist now includes a seal check.' },
  ]
  const incBefore = await count('safety_incidents')
  if (incBefore === 0) {
    const rows = incidentDefs.map(i => ({
      tenant_id: T(), staff_id: i.staff ? sid(i.staff) : null, incident_date: iso(daysAgo(i.ago)), incident_type: i.type,
      description: i.desc, location: i.location, witnesses: [], immediate_action: i.immediate, root_cause: i.root,
      corrective_action: i.corrective, iod_reported: false, iod_reference: null, documents_url: null,
      created_by: OWNER_ID, created_at: iso(daysAgo(i.ago)),
    }))
    await pgInsert('safety_incidents', rows)
    log('safety_incidents', incBefore, await count('safety_incidents'))
  } else log('safety_incidents', incBefore, incBefore)

  // 15. Employment equity data (real upsert — unique on tenant_id, reporting_year)
  const eeBefore = await count('employment_equity_data')
  const demographics = {
    african_male: 3, african_female: 2, coloured_male: 0, coloured_female: 2,
    indian_male: 0, indian_female: 1, white_male: 1, white_female: 0,
    foreign_male: 0, foreign_female: 0, disabled: 0,
  }
  const occupationalLevels = {
    'Top Management': 1, 'Senior Management': 1, 'Professionally Qualified': 1,
    'Skilled Technical': 2, 'Semi-Skilled': 3, 'Unskilled': 1,
  }
  await pgUpsert('employment_equity_data', {
    tenant_id: TENANT_ID, reporting_year: 2026, total_workforce: 9,
    demographics, occupational_levels: occupationalLevels,
  }, 'tenant_id,reporting_year')
  log('employment_equity_data', eeBefore, await count('employment_equity_data'))

  // 16. Business health snapshots
  const hsBefore = await count('business_health_snapshots')
  if (hsBefore === 0) {
    const rows = [
      {
        tenant_id: T(), snapshot_date: isoD(daysAgo(28)),
        overall_score: 64, financial_health: 58, legal_compliance: 62, people_management: 68,
        customer_relations: 74, operational_maturity: 60, strategic_readiness: 65,
        dimension_details: {
          financial: { overdueCount: 3, totalOverdue: 4200, avgDebtorDays: 42, recentRevenue: 38000 },
          legal: { totalDocs: 6, expiredDocs: 1, expiringDocs: 1 },
          people: { activeStaff: 9, avgWellness: null, pendingLeave: 1 },
          customer: { totalConversations: 14, resolutionRate: 78, negativeCount: 1, totalContacts: 12 },
          operational: { totalGoals: 5, onTrackGoals: 3, goalHitRate: 60, documentCount: 6 },
          strategic: { totalGoals: 5, futureGoals: 4, overdueGoals: 0 },
        },
        created_at: iso(daysAgo(28)),
      },
      {
        tenant_id: T(), snapshot_date: isoD(now),
        overall_score: 72, financial_health: 66, legal_compliance: 68, people_management: 75,
        customer_relations: 80, operational_maturity: 70, strategic_readiness: 74,
        dimension_details: {
          financial: { overdueCount: 2, totalOverdue: 2500, avgDebtorDays: 33, recentRevenue: 46500 },
          legal: { totalDocs: 11, expiredDocs: 1, expiringDocs: 1 },
          people: { activeStaff: 9, avgWellness: null, pendingLeave: 0 },
          customer: { totalConversations: 21, resolutionRate: 86, negativeCount: 0, totalContacts: 14 },
          operational: { totalGoals: 7, onTrackGoals: 4, goalHitRate: 57, documentCount: 11 },
          strategic: { totalGoals: 7, futureGoals: 4, overdueGoals: 0 },
        },
        created_at: iso(now),
      },
    ]
    await pgInsert('business_health_snapshots', rows)
    log('business_health_snapshots', hsBefore, await count('business_health_snapshots'))
  } else log('business_health_snapshots', hsBefore, hsBefore)

  console.log('\nDone. Summary:')
  console.table(report)
}

main().catch(err => { console.error('\nSEED FAILED:', err.message); process.exit(1) })
