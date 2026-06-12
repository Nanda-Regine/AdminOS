import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { fireBusinessEvent } from '@/lib/academy/knowledgeGraph'
import { checkAchievements } from '@/lib/academy/checkAchievements'

const updateSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  progressPct: z.number().min(0).max(100).optional(),
  status:      z.enum(['active','completed','cancelled','paused']).optional(),
  targetDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { id } = await params

  let body: z.infer<typeof updateSchema>
  try { body = updateSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.title       !== undefined) updates.title        = body.title
  if (body.description !== undefined) updates.description  = body.description
  if (body.progressPct !== undefined) updates.progress_pct = body.progressPct
  if (body.status      !== undefined) updates.status       = body.status
  if (body.targetDate  !== undefined) updates.target_date  = body.targetDate

  if (body.status === 'completed') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabaseAdmin
    .from('goals')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // On first goal completion, fire event and check achievements
  if (body.status === 'completed') {
    fireBusinessEvent('goal.completed', tenantId, user.id)
    checkAchievements({ tenantId, userId: user.id, event: 'goal.completed' }).catch(() => null)
  }

  return NextResponse.json(data)
}
