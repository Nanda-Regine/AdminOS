import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const signSchema = z.object({
  signerName: z.string().min(1).max(200),
  token:      z.string().min(1),
})

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const url   = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }

  const { data: contract, error } = await supabaseAdmin
    .from('contracts')
    .select('id, tenant_id, title, body, status, sign_token, signed_at, signer_name')
    .eq('id', id)
    .eq('status', 'sent')
    .eq('sign_token', token)
    .single()

  if (error || !contract) {
    return NextResponse.json({ error: 'Contract not found or not available for signing' }, { status: 404 })
  }

  // Return contract details without sensitive internals (sign_token omitted from response)
  const { sign_token: _omit, ...safeContract } = contract
  return NextResponse.json(safeContract)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: z.infer<typeof signSchema>
  try { body = signSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // Verify token and that contract is still in 'sent' state
  const { data: contract, error: lookupError } = await supabaseAdmin
    .from('contracts')
    .select('id, status, sign_token')
    .eq('id', id)
    .eq('sign_token', body.token)
    .single()

  if (lookupError || !contract) {
    return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 404 })
  }

  if (contract.status !== 'sent') {
    return NextResponse.json({ error: 'Contract is not available for signing' }, { status: 409 })
  }

  // Extract signer IP from headers
  const signerIp =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null

  const signedAt = new Date().toISOString()

  const { error: updateError } = await supabaseAdmin
    .from('contracts')
    .update({
      status:      'signed',
      signed_at:   signedAt,
      signer_name: body.signerName,
      signer_ip:   signerIp,
    })
    .eq('id', id)
    .eq('sign_token', body.token)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  return NextResponse.json({ success: true, signed_at: signedAt })
}
