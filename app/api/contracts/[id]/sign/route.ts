import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { dbError } from '@/lib/api/guard'
import { createHash } from 'node:crypto'
import { writeAuditLog } from '@/lib/security/audit'

// @public — contract signing by per-signer token. The signing model lives in `contract_signatures`
// (one row per signer, each with its own auto-generated `token`), NOT on the
// `contracts` row — contracts has no sign_token/signer_name/body columns.
// GET  ?token=…  → return the contract to display to the signer
// POST { token, signerName, signatureData? } → record that signer's signature;
//       once every signer has signed, the contract flips to 'signed'.

const signSchema = z.object({
  signerName:    z.string().min(1).max(200),
  token:         z.string().min(1),
  signatureData: z.string().max(200_000).optional(),
})

function clientIp(request: Request): string | null {
  const raw =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    ''
  // ip_address is an inet column — only store a syntactically valid IP.
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6 = /^[0-9a-fA-F:]+$/
  return ipv4.test(raw) || (raw.includes(':') && ipv6.test(raw)) ? raw : null
}

async function findInvite(contractId: string, token: string) {
  const { data } = await supabaseAdmin
    .from('contract_signatures')
    .select('id, contract_id, signer_name, signer_email, signed_at, expires_at')
    .eq('contract_id', contractId)
    .eq('token', token)
    .maybeSingle()
  return data
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const invite = await findInvite(id, token)
  if (!invite) return NextResponse.json({ error: 'Contract not found or not available for signing' }, { status: 404 })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 })
  }

  const { data: contract } = await supabaseAdmin
    .from('contracts')
    .select('id, title, content, status').is('deleted_at', null)
    .eq('id', id)
    .single()

  if (!contract) return NextResponse.json({ error: 'Contract not found' }, { status: 404 })

  return NextResponse.json({
    id:            contract.id,
    title:         contract.title,
    content:       contract.content,
    status:        contract.status,
    alreadySigned: Boolean(invite.signed_at),
    signer:        { name: invite.signer_name, email: invite.signer_email },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: z.infer<typeof signSchema>
  try { body = signSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const invite = await findInvite(id, body.token)
  if (!invite) return NextResponse.json({ error: 'Invalid or expired signing link' }, { status: 404 })
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This signing link has expired' }, { status: 410 })
  }
  if (invite.signed_at) return NextResponse.json({ error: 'This contract has already been signed' }, { status: 409 })

  // What exactly is being signed. Hashed into the audit trail with the
  // signer, IP and time, so the signed terms can be proven later. Terms lock
  // once signing starts (PATCH /api/contracts/[id]). (Which ECTA standard a
  // simple e-signature meets is a Workstream F check.)
  const { data: contract } = await supabaseAdmin
    .from('contracts').select('id, tenant_id, title, content, status').eq('id', id).is('deleted_at', null).maybeSingle()
  if (!contract || contract.status === 'cancelled' || contract.status === 'expired') {
    return NextResponse.json({ error: 'This contract is no longer available for signing' }, { status: 410 })
  }
  const contentHash = createHash('sha256').update(JSON.stringify({ title: contract.title, content: contract.content })).digest('hex')

  const signedAt = new Date().toISOString()

  // Record this signer's signature on their invite row.
  const { error: sigError } = await supabaseAdmin
    .from('contract_signatures')
    .update({
      signer_name:    body.signerName,
      signed_at:      signedAt,
      signature_data: body.signatureData ?? null,
      ip_address:     clientIp(request),
    })
    .eq('id', invite.id)

  if (sigError) return dbError(sigError)

  // When every signer on the contract has signed, mark the contract signed.
  const { data: outstanding } = await supabaseAdmin
    .from('contract_signatures')
    .select('id')
    .eq('contract_id', id)
    .is('signed_at', null)

  const fullySigned = !outstanding || outstanding.length === 0
  await supabaseAdmin
    .from('contracts')
    .update(fullySigned ? { status: 'signed', signed_at: signedAt } : { status: 'partially_signed' })
    .eq('id', id)

  await writeAuditLog({
    tenantId: contract.tenant_id,
    actor: `signer:${invite.id}`,
    action: 'contract.signed',
    resourceType: 'contract',
    resourceId: id,
    ipAddress: clientIp(request) ?? undefined,
    metadata: { signer_name: body.signerName, signer_email: invite.signer_email, content_sha256: contentHash, signed_at: signedAt, fully_signed: fullySigned },
    critical: true,
  }).catch((e) => console.error('[contract sign] evidence audit failed', e))

  return NextResponse.json({ success: true, signed_at: signedAt, fullySigned })
}
