import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { guard, dbError } from '@/lib/api/guard'

// GET /api/academy/certificates — list all certificates earned by this user
export async function GET(request: Request) {
  const gate = await guard('academy.learn'); if (gate.denied) return gate.denied
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const tenantId = user.app_metadata?.tenant_id as string
  if (!tenantId) return new NextResponse('No tenant', { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('academy_certificates')
    .select('*, module:academy_modules(title, level)')
    .eq('user_id', user.id)
    .order('issued_at', { ascending: false })

  if (error) return dbError(error)
  return NextResponse.json(data)
}
