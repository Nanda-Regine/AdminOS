import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { z } from 'zod'
import { inngest } from '@/inngest/client'
import { checkAchievements } from '@/lib/academy/checkAchievements'
import { updateLearningStreak } from '@/lib/academy/checkAchievements'

const completeSchema = z.object({
  score:            z.number().min(0).max(100).optional(),
  timeSpentSeconds: z.number().int().nonnegative().optional(),
})

// GET /api/academy/lessons/[lessonId] — get lesson with content
export async function GET(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { lessonId } = await params

  const [lessonRes, progressRes] = await Promise.all([
    supabaseAdmin
      .from('academy_lessons')
      .select('*, module:academy_modules(id, title, level)')
      .eq('id', lessonId)
      .single(),
    supabaseAdmin
      .from('academy_progress')
      .select('*')
      .eq('lesson_id', lessonId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (lessonRes.error) return NextResponse.json({ error: 'Lesson not found' }, { status: 404 })

  // Track view (upsert to create record if first time)
  if (!progressRes.data) {
    await supabaseAdmin
      .from('academy_progress')
      .upsert({ tenant_id: tenantId, user_id: user.id, lesson_id: lessonId })
      .select()
  }

  return NextResponse.json({
    lesson:   lessonRes.data,
    progress: progressRes.data ?? { completed_at: null, score: null },
  })
}

// POST /api/academy/lessons/[lessonId] — mark lesson complete
export async function POST(request: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.user_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { lessonId } = await params

  let body: z.infer<typeof completeSchema>
  try { body = completeSchema.parse(await request.json()) } catch (e) {
    return NextResponse.json({ error: 'Invalid request', detail: e }, { status: 400 })
  }

  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('academy_progress')
    .upsert({
      tenant_id:          tenantId,
      user_id:            user.id,
      lesson_id:          lessonId,
      completed_at:       now,
      score:              body.score ?? null,
      time_spent_seconds: body.timeSpentSeconds ?? null,
    }, { onConflict: 'user_id,lesson_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Fire lesson completion event (triggers streak update + achievement check)
  void inngest.send({
    name: 'adminos/academy.lesson.completed',
    data: { tenant_id: tenantId, user_id: user.id, lesson_id: lessonId },
  })

  // Update triggered lesson completion if any
  await supabaseAdmin
    .from('triggered_lessons')
    .update({ completed_at: now })
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .is('completed_at', null)

  // Check if module is now complete → issue certificate
  const { data: lesson } = await supabaseAdmin
    .from('academy_lessons')
    .select('module_id, module:academy_modules(level, module_number)')
    .eq('id', lessonId)
    .single()

  if (lesson?.module_id) {
    // Step 1: get all lesson IDs for this module
    const { data: allLessons } = await supabaseAdmin
      .from('academy_lessons')
      .select('id')
      .eq('module_id', lesson.module_id)

    const allIds = (allLessons ?? []).map(l => l.id)

    if (allIds.length > 0) {
      // Step 2: check how many are completed (including the one we just finished)
      const { data: completedLessons } = await supabaseAdmin
        .from('academy_progress')
        .select('lesson_id')
        .eq('user_id', user.id)
        .not('completed_at', 'is', null)
        .in('lesson_id', allIds)

      const doneIds = new Set((completedLessons ?? []).map(p => p.lesson_id))
      doneIds.add(lessonId)

      if (allIds.every(id => doneIds.has(id))) {
        // Module complete — award module certificate
        await supabaseAdmin.from('academy_certificates').upsert({
          tenant_id:        tenantId,
          user_id:          user.id,
          certificate_type: 'module',
          module_id:        lesson.module_id,
          issued_at:        now,
        }, { onConflict: 'user_id,module_id' })

        void checkAchievements({ tenantId, userId: user.id, event: 'module.completed' })
      }
    }
  }

  return NextResponse.json({ progress: data, completed: true })
}
