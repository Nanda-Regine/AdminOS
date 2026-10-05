import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { withRoute, unwrap } from '@/lib/api/withRoute'

// Both handlers used to be open to any logged-in member of the tenant.

const createSchema = z.object({
  name:          z.string().trim().min(1).max(300),
  category:      z.string().max(100).optional(),
  phone:         z.string().max(20).optional(),
  email:         z.string().email().max(320).optional(),
  website:       z.string().url().max(500).optional(),
  contactPerson: z.string().max(200).optional(),
  paymentTerms:  z.number().int().nonnegative().max(365).default(30),
  // Typo kept: `bbbbeeLlevel` is the shipped contract the Add Supplier form sends.
  bbbbeeLlevel:  z.number().int().min(1).max(8).optional(),
  womenOwned:    z.boolean().default(false),
  youthOwned:    z.boolean().default(false),
  notes:         z.string().max(2000).optional(),
})

const listQuery = z.object({
  category:   z.string().max(100).optional(),
  bbbee:      z.coerce.number().int().min(1).max(8).optional(),   // max B-BBEE level
  womenOwned: z.enum(['true', 'false']).optional(),
  youthOwned: z.enum(['true', 'false']).optional(),
})

export const GET = withRoute({ action: 'suppliers.read', query: listQuery }, async ({ ctx, query }) => {
  let q = supabaseAdmin
    .from('suppliers')
    .select('id, name, category, phone, email, website, contact_person, payment_terms, rating, is_community_verified, bbbbee_level, women_owned, youth_owned, notes, created_at')
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .order('name')
    .limit(500)

  if (query.category)              q = q.eq('category', query.category)
  if (query.bbbee)                 q = q.lte('bbbbee_level', query.bbbee)
  if (query.womenOwned === 'true') q = q.eq('women_owned', true)
  if (query.youthOwned === 'true') q = q.eq('youth_owned', true)

  return unwrap(await q) ?? []
})

export const POST = withRoute({
  action: 'suppliers.write',
  body: createSchema,
  status: 201,
  audit: 'supplier.created',
  resourceType: 'supplier',
}, async ({ ctx, body }) =>
  unwrap(await supabaseAdmin
    .from('suppliers')
    .insert({
      tenant_id:      ctx.tenantId,
      name:           body.name,
      category:       body.category      ?? null,
      phone:          body.phone         ?? null,
      email:          body.email         ?? null,
      website:        body.website       ?? null,
      contact_person: body.contactPerson ?? null,
      payment_terms:  body.paymentTerms,
      bbbbee_level:   body.bbbbeeLlevel  ?? null,
      women_owned:    body.womenOwned,
      youth_owned:    body.youthOwned,
      notes:          body.notes         ?? null,
    })
    .select()
    .single()),
)
