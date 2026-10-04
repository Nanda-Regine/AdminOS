import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { harness, call } from './helpers/routeHarness.ts'
import { RouteError, unwrap, mapError } from '../lib/api/handler.ts'

const schema = z.object({ name: z.string().min(1), amount: z.number().positive() })

test('no session → 401, handler never runs', async () => {
  const h = harness(null)
  let ran = false
  const route = h.withRoute({ action: 'tasks.read' }, async () => { ran = true; return {} })
  const res = await call(route)
  assert.equal(res.status, 401)
  assert.equal(ran, false)
})

test('wrong role → 403; permitted role → 200', async () => {
  const h = harness({ role: 'staff' })
  const route = h.withRoute({ action: 'payroll.distribute' }, async () => ({ ok: true }))
  assert.equal((await call(route, { method: 'POST' })).status, 403)
  h.as({ role: 'owner' })
  assert.equal((await call(route, { method: 'POST' })).status, 200)
  h.as({ role: 'manager' }) // managers approve leave but do not see payroll
  assert.equal((await call(route, { method: 'POST' })).status, 403)
})

test('permissions, not role names, decide — a customised staff role can be granted payroll', async () => {
  const h = harness({ role: 'staff', permissions: ['view_payroll'] })
  const route = h.withRoute({ action: 'payroll.read' }, async () => ({ ok: true }))
  assert.equal((await call(route)).status, 200)
})

test('member actions are open to every role, including client', async () => {
  const h = harness({ role: 'client' })
  const route = h.withRoute({ action: 'payslip.read_own' }, async ({ ctx }) => ({ who: ctx.role }))
  const res = await call(route)
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { who: 'client' })
})

test('super-admin passes every action', async () => {
  const h = harness({ role: 'client', permissions: [], isSuperAdmin: true })
  const route = h.withRoute({ action: 'billing.manage' }, async () => ({ ok: true }))
  assert.equal((await call(route, { method: 'POST' })).status, 200)
})

test('invalid body → 400 with per-field messages; handler never runs', async () => {
  const h = harness()
  let ran = false
  const route = h.withRoute({ action: 'invoices.write', body: schema }, async () => { ran = true; return {} })
  const res = await call(route, { body: { name: '', amount: -5 } })
  assert.equal(res.status, 400)
  assert.equal(res.body.code, 'invalid_body')
  assert.ok(res.body.fields.name)
  assert.ok(res.body.fields.amount)
  assert.equal(ran, false)
})

test('malformed JSON → 400, not 500', async () => {
  const h = harness()
  const route = h.withRoute({ action: 'invoices.write', body: schema }, async () => ({}))
  const res = await call(route, { rawBody: '{nope' })
  assert.equal(res.status, 400)
  assert.equal(res.body.code, 'invalid_json')
})

test('valid body and query reach the handler parsed', async () => {
  const h = harness()
  const route = h.withRoute({
    action: 'invoices.write',
    body: schema,
    query: z.object({ dryRun: z.enum(['true', 'false']).optional() }),
  }, async ({ body, query }) => ({ name: body.name, total: body.amount * 2, dryRun: query.dryRun }))
  const res = await call(route, { body: { name: 'Acme', amount: 50 }, query: { dryRun: 'true' } })
  assert.equal(res.status, 200)
  assert.deepEqual(res.body, { name: 'Acme', total: 100, dryRun: 'true' })
})

test('DB errors become friendly messages — constraint names never reach the client', async () => {
  const h = harness()
  const route = h.withRoute({ action: 'contacts.write' }, async () => {
    throw { code: '23505', message: 'duplicate key value violates unique constraint "contacts_tenant_phone_key"' }
  })
  const res = await call(route, { method: 'POST' })
  assert.equal(res.status, 409)
  assert.doesNotMatch(JSON.stringify(res.body), /contacts_tenant_phone_key|duplicate key/)
  assert.equal(h.reports.length, 0) // an expected conflict, not an incident
})

test('unexpected errors → generic 500, reported with route context, message not leaked', async () => {
  const h = harness({ role: 'owner', tenantId: 't-9' })
  const route = h.withRoute({ action: 'money.read' }, async () => {
    throw new Error('connect ECONNREFUSED 10.0.0.4:5432 password=hunter2')
  })
  const res = await call(route)
  assert.equal(res.status, 500)
  assert.doesNotMatch(JSON.stringify(res.body), /ECONNREFUSED|hunter2/)
  assert.equal(h.reports.length, 1)
  assert.equal(h.reports[0].info.tenantId, 't-9')
  assert.equal(h.reports[0].info.action, 'money.read')
})

test('RouteError passes its status and message through', async () => {
  const h = harness()
  const route = h.withRoute({ action: 'tasks.write' }, async () => {
    throw new RouteError(422, 'Due date is in the past', 'past_due')
  })
  const res = await call(route, { method: 'POST' })
  assert.equal(res.status, 422)
  assert.equal(res.body.error, 'Due date is in the past')
})

test('unwrap(required) on a missing row → 404 (other tenant and non-existent look the same)', async () => {
  const h = harness()
  const route = h.withRoute({ action: 'invoices.read' }, async () =>
    unwrap({ data: null, error: null }, { required: true }))
  assert.equal((await call(route)).status, 404)
})

test('audit row on success: resourceId from the result id, then params.id', async () => {
  const h = harness({ role: 'owner', tenantId: 't-1', userId: 'u-1' })
  const withId = h.withRoute(
    { action: 'invoices.write', audit: 'invoice.created', resourceType: 'invoice' },
    async () => ({ id: 'inv-7' }),
  )
  await call(withId, { method: 'POST' })
  const fromParams = h.withRoute(
    { action: 'payroll.distribute', audit: 'payroll.distributed' },
    async () => ({ ok: true }),
  )
  await call(fromParams, { method: 'POST', params: { id: 'run-3' } })
  assert.deepEqual(h.audits.map((a) => [a.action, a.resourceId, a.tenantId, a.actor]), [
    ['invoice.created', 'inv-7', 't-1', 'u-1'],
    ['payroll.distributed', 'run-3', 't-1', 'u-1'],
  ])
})

test('no audit row when the route fails, returns an error Response, or is forbidden', async () => {
  const h = harness()
  const throws = h.withRoute({ action: 'invoices.write', audit: 'invoice.created' }, async () => {
    throw new RouteError(400, 'no')
  })
  const errResponse = h.withRoute({ action: 'invoices.write', audit: 'invoice.created' }, async () =>
    new Response('x', { status: 409 }))
  await call(throws, { method: 'POST' })
  await call(errResponse, { method: 'POST' })
  h.as({ role: 'staff' })
  await call(h.withRoute({ action: 'payroll.run', audit: 'payroll.ran' }, async () => ({})), { method: 'POST' })
  assert.equal(h.audits.length, 0)
})

test('rate limit → 429 before the handler runs', async () => {
  const h = harness()
  h.limit(true)
  let ran = false
  const route = h.withRoute({ action: 'broadcasts.send', rateLimit: 'api' }, async () => { ran = true; return {} })
  assert.equal((await call(route, { method: 'POST' })).status, 429)
  assert.equal(ran, false)
})

test('a returned Response is passed through untouched', async () => {
  const h = harness()
  const route = h.withRoute({ action: 'payslip.read_own' }, async () =>
    new Response('<html/>', { headers: { 'Content-Type': 'text/html' } }))
  const res = await call(route)
  assert.equal(res.status, 200)
  assert.equal(res.body, '<html/>')
})

test('mapError: AuthError → 401, PermissionError → 403, matched by name', () => {
  const auth = Object.assign(new Error('x'), { name: 'AuthError' })
  const perm = Object.assign(new Error('x'), { name: 'PermissionError' })
  assert.equal(mapError(auth)[0], 401)
  assert.equal(mapError(perm)[0], 403)
})
