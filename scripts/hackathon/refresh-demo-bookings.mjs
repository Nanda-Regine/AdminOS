// Demo tenant ("Mzansi Test Traders") only: the seeded bookings are all in the past,
// so the Bookings page reads empty. Adds bookings around "today" (SAST), tagged so
// re-running is a no-op. Inserts rows only — never touches tenants/users/roles.
//   node scripts/hackathon/refresh-demo-bookings.mjs
import { select, insert } from '../lib/qa.mjs'

const T = 'c1336f9c-0617-46f2-978f-605da9ad2ebc'
const TAG = 'Demo data (hackathon refresh)'

const existing = await select('bookings', `tenant_id=eq.${T}&notes=eq.${encodeURIComponent(TAG)}&select=id&limit=1`)
if (existing.length) { console.log('already refreshed — nothing to do'); process.exit(0) }

const [contacts, services, staff] = await Promise.all([
  select('contacts', `tenant_id=eq.${T}&select=id,full_name`),
  select('booking_services', `tenant_id=eq.${T}&select=id,name,duration_minutes`),
  select('staff', `tenant_id=eq.${T}&select=id,full_name`),
])
const cid = n => contacts.find(c => c.full_name === n)?.id ?? null
const sv = n => services.find(s => s.name === n)
const sid = n => staff.find(s => s.full_name === n)?.id ?? null

// Monday of the current SAST week at 00:00 SAST, as a UTC instant.
const sastNow = new Date(Date.now() + 2 * 3600e3)
const dow = (sastNow.getUTCDay() + 6) % 7
const monday = Date.UTC(sastNow.getUTCFullYear(), sastNow.getUTCMonth(), sastNow.getUTCDate() - dow) - 2 * 3600e3
const at = (dayOffset, hour) => new Date(monday + dayOffset * 86400e3 + hour * 3600e3)

const defs = [
  // [dayOffset from Monday, SAST hour, contact, service, staff, status, source]
  [0, 9,  'Nokuthula Mahlangu', 'Delivery Slot — Local', 'Bongani Zulu',  'completed', 'whatsapp'],
  [1, 11, 'Peter Botha',        'Bulk Order Collection', 'Sipho Ndlovu',  'completed', 'manual'],
  [2, 14, 'Karen Fourie',       'Stock Consultation',    'Nomsa Dlamini', 'completed', 'portal'],
  [4, 10, 'Xolani Mgudlwa',     'Delivery Slot — Local', 'Bongani Zulu',  'completed', 'whatsapp'],
  [5, 12, 'Aisha Adams',        'Bulk Order Collection', 'Sipho Ndlovu',  'confirmed', 'widget'],
  [5, 15, 'Themba Nkosi',       'Stock Consultation',    'Nomsa Dlamini', 'confirmed', 'portal'],
  [7, 9,  'David Naidoo',       'Delivery Slot — Local', 'Bongani Zulu',  'confirmed', 'whatsapp'],
  [8, 11, 'Sipho Radebe',       'Bulk Order Collection', 'Sipho Ndlovu',  'confirmed', 'manual'],
  [9, 14, 'Riaan Pretorius',    'Stock Consultation',    'Nomsa Dlamini', 'pending',   'portal'],
  [10, 10, 'Bulelani Gqirana',  'Delivery Slot — Local', 'Bongani Zulu',  'confirmed', 'whatsapp'],
]

const rows = defs.map(([d, h, c, s, st, status, source]) => {
  const svc = sv(s)
  const start = at(d, h)
  return {
    tenant_id: T, service_id: svc?.id ?? null, contact_id: cid(c), staff_id: sid(st),
    start_at: start.toISOString(), end_at: new Date(start.getTime() + (svc?.duration_minutes ?? 60) * 60e3).toISOString(),
    status, source, notes: TAG,
  }
})
const missing = rows.filter(r => !r.service_id || !r.contact_id)
if (missing.length) { console.error('lookup failed for', missing.length, 'rows — aborting, nothing inserted'); process.exit(1) }
const out = await insert('bookings', rows)
console.log('inserted', out.length, 'bookings')
