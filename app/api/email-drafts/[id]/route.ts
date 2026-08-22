import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { z } from 'zod'

const resend = new Resend(process.env.RESEND_API_KEY!)

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  const { data, error } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

// Editable fields only — the old handler spread the raw request body
// straight into .update(), so any caller could also try to overwrite
// tenant_id/id/created_at etc. Narrowed while fixing the updated_at bug
// below, since nothing here was validated at all.
const patchSchema = z.object({
  subject: z.string().max(300).optional(),
  body: z.string().max(20000).optional(),
  recipient_name: z.string().max(200).optional(),
  recipient_email: z.string().email().optional(),
})

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  let body: z.infer<typeof patchSchema>
  try { body = patchSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  // email_drafts has no updated_at column — this update always 400'd
  // (unknown column), so no draft edit has ever actually saved.
  const { data, error } = await supabase
    .from('email_drafts')
    .update(body)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

const sendSchema = z.object({ action: z.literal('send') })

export async function POST(request: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  const body = await request.json()

  try { sendSchema.parse(body) } catch {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const { data: draft, error } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (error || !draft) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!draft.recipient_email) return NextResponse.json({ error: 'No recipient email' }, { status: 400 })

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL!,
    to: draft.recipient_email,
    subject: draft.subject,
    text: draft.body,
  })

  await supabase
    .from('email_drafts')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  return NextResponse.json({ status: 'sent' })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  await supabase.from('email_drafts').delete().eq('id', id).eq('tenant_id', tenantId)
  return new NextResponse(null, { status: 204 })
}
