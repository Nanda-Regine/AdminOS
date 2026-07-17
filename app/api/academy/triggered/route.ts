import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'

const dismissSchema = z.object({ triggeredId: z.string().uuid() })

// GET /api/academy/triggered — get pending contextual learning nudges for this user
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('triggered_lessons')
    .select('*, trigger:contextual_triggers(event_type, message_template, framework_slug, framework:framework_library(book_title, core_insight, urgency, action_label, action_route))')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .is('completed_at', null)
    .order('triggered_at', { ascending: false })
    .limit(5)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// PATCH /api/academy/triggered — dismiss a nudge without completing it
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  let body: z.infer<typeof dismissSchema>
  try { body = dismissSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('triggered_lessons')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', body.triggeredId)
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
