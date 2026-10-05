import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { withRoute, unwrap, notFound } from '@/lib/api/withRoute'
import { can } from '@/lib/auth/roleMatrix'
import { ownStaffId } from '@/lib/people/ownStaff'
import { RECEIPT_BUCKET, receiptPath } from '@/lib/expenses/receipts'

// GET /api/expenses/[id]/receipt — open a claim's receipt. Finance sees any;
// a claimant sees their own; everyone else gets the same 404 as a missing id.
// Redirects to a 5-minute signed URL (web), or returns { url } with ?json=1
// (the app opens it itself).
export const GET = withRoute({ action: 'expenses.submit' }, async ({ request, ctx, params }) => {
  const claim = unwrap(await supabaseAdmin
    .from('expenses')
    .select('id, staff_id, receipt_url')
    .eq('id', params.id)
    .eq('tenant_id', ctx.tenantId)
    .is('deleted_at', null)
    .maybeSingle(), { required: true, what: 'Receipt not found' })

  if (!can(ctx, 'expenses.read_all') && claim.staff_id !== await ownStaffId(ctx.tenantId, ctx.userId)) {
    throw notFound('Receipt not found')
  }

  const path = receiptPath(claim.receipt_url as string | null)
  let url: string | null = null
  if (path) {
    // The ref was validated to this tenant's folder when the claim was filed.
    const { data, error } = await supabaseAdmin.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 300)
    if (error) throw notFound('Receipt not found')
    url = data.signedUrl
  } else if (typeof claim.receipt_url === 'string' && claim.receipt_url.startsWith('https://')) {
    url = claim.receipt_url
  }
  if (!url) throw notFound('This claim has no receipt.')

  if (new URL(request.url).searchParams.get('json') === '1') return { url }
  return NextResponse.redirect(url, 302)
})
