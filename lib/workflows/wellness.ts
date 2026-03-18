import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { writeAuditLog } from '@/lib/security/audit'

async function getActiveStaff(tenantId: string) {
  const { data } = await supabaseAdmin
    .from('staff')
    .select('*')
    .eq('tenant_id', tenantId)
  return data || []
}

async function getRecentWellnessScores(staffId: string, days: number) {
  const { data } = await supabaseAdmin
    .from('staff')
    .select('wellness_scores')
    .eq('id', staffId)
    .single()

  const scores = (data?.wellness_scores || []) as Array<{ score: number; date: string }>
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  return scores.filter((s) => new Date(s.date) >= cutoff)
}

async function alertManager(tenantId: string, staffId: string, type: string, value: number): Promise<void> {
  await supabaseAdmin.from('audit_log').insert({
    tenant_id: tenantId,
    actor: 'system',
    action: 'wellness.alert',
    resource_type: 'staff',
    resource_id: staffId,
    metadata: { type, value },
  })
}

export async function sendWellnessCheckIn(tenantId: string): Promise<void> {
  const staff = await getActiveStaff(tenantId)

  for (const member of staff) {
    if (!member.phone) continue

    const firstName = member.full_name.split(' ')[0]
    await sendWhatsApp({
      to: member.phone,
      message: `Good morning ${firstName}! Quick check-in — how are you feeling today?\n\nReply:\n1 = Tough day\n2 = Getting by\n3 = Good\n4 = Great\n5 = On fire 🔥`,
    })
  }

  await writeAuditLog({
    tenantId,
    actor: 'system',
    action: 'wellness.checkin_sent',
    metadata: { staffCount: staff.length },
  })
}

export async function recordWellnessScore(
  tenantId: string,
  staffId: string,
  score: number
): Promise<void> {
  // Append new score to the JSONB array
  const { data: staffData } = await supabaseAdmin
    .from('staff')
    .select('wellness_scores, tenant_id')
    .eq('id', staffId)
    .single()

  const existing = (staffData?.wellness_scores || []) as Array<{ score: number; date: string }>
  const updated = [...existing, { score, date: new Date().toISOString() }]

  await supabaseAdmin
    .from('staff')
    .update({ wellness_scores: updated })
    .eq('id', staffId)

  // Check burnout risk
  const recentScores = await getRecentWellnessScores(staffId, 7)
  if (recentScores.length >= 3) {
    const avg = recentScores.reduce((a, b) => a + b.score, 0) / recentScores.length
    if (avg < 2.5) {
      await alertManager(tenantId, staffId, 'burnout_risk', avg)
    }
  }

  // Detect after-hours
  const hour = new Date().getHours()
  if (hour > 19 || hour < 7) {
    await supabaseAdmin
      .from('staff')
      .update({ after_hours_flag: true })
      .eq('id', staffId)
  }

  await writeAuditLog({
    tenantId,
    actor: staffId,
    action: 'wellness.score_recorded',
    resourceType: 'staff',
    resourceId: staffId,
    metadata: { score },
  })
}
