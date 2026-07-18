/**
 * Operations intelligence — stock readiness + the day's schedule + work-in-flight.
 * Same vertical-slice contract as lib/money/signal.ts. Outcome it must deliver:
 * no stockouts, zero no-shows, jobs on time.
 */

import { supabaseAdmin } from '@/lib/supabase/admin'
import { publishSignal, type OpsSignal } from '@/lib/signals/bus'

export interface LowStockItem { name: string; onHand: number; reorderAt: number; shortBy: number }
export interface TodayBooking { id: string; when: string; who: string; service: string; status: string }

export interface OpsIntel {
  signal: OpsSignal
  lowStockItems: LowStockItem[]
  totalSkus: number
  stockValueCost: number
  stockValueRetail: number
  bookingsToday: TodayBooking[]
  upcoming7: number
  pendingBookings: number
  openTasks: number
  overdueTasks: number
}

const embedName = (embed: unknown, field: string): string => {
  const e = Array.isArray(embed) ? embed[0] : embed
  return (e as Record<string, string> | null)?.[field] ?? ''
}

export async function buildOpsIntel(tenantId: string): Promise<OpsIntel> {
  const now = new Date()
  const todayISO = now.toISOString().slice(0, 10)
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString()

  const [prodRes, bookRes, taskRes] = await Promise.all([
    supabaseAdmin.from('products').select('name, current_stock, reorder_level, cost_price, unit_price').eq('tenant_id', tenantId),
    supabaseAdmin
      .from('bookings')
      .select('id, start_at, status, contact:contacts(full_name), service:booking_services(name)')
      .eq('tenant_id', tenantId)
      .gte('start_at', todayISO)
      .lte('start_at', in7)
      .order('start_at'),
    supabaseAdmin.from('tasks').select('status, due_date').eq('tenant_id', tenantId).not('status', 'in', '("done","completed","cancelled")'),
  ])

  const products = prodRes.data ?? []
  const bookings = bookRes.data ?? []
  const tasks = taskRes.data ?? []

  // ── Stock readiness ────────────────────────────────────────────────────────
  const lowStockItems: LowStockItem[] = products
    .filter(p => Number(p.current_stock) <= Number(p.reorder_level))
    .map(p => ({
      name: p.name,
      onHand: Number(p.current_stock),
      reorderAt: Number(p.reorder_level),
      shortBy: Math.max(0, Number(p.reorder_level) - Number(p.current_stock)),
    }))
    .sort((a, b) => b.shortBy - a.shortBy)
  const stockValueCost = products.reduce((s, p) => s + Number(p.current_stock) * Number(p.cost_price || 0), 0)
  const stockValueRetail = products.reduce((s, p) => s + Number(p.current_stock) * Number(p.unit_price || 0), 0)

  // ── Schedule ───────────────────────────────────────────────────────────────
  const bookingsToday: TodayBooking[] = bookings
    .filter(b => (b.start_at ?? '').slice(0, 10) === todayISO)
    .map(b => ({
      id: b.id,
      when: new Date(b.start_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' }),
      who: embedName(b.contact, 'full_name') || 'Walk-in',
      service: embedName(b.service, 'name') || 'Appointment',
      status: b.status,
    }))
  const pendingBookings = bookings.filter(b => b.status === 'pending').length
  const upcoming7 = bookings.length

  // ── Work in flight ─────────────────────────────────────────────────────────
  const openTasks = tasks.length
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < now).length

  const signal: OpsSignal = {
    lowStock: lowStockItems.length,
    stockoutRisk: lowStockItems.slice(0, 5).map(i => i.name),
    bookingsToday: bookingsToday.length,
    pendingBookings,
    overdueTasks,
    health: lowStockItems.length > 0 || overdueTasks > 0 ? (lowStockItems.length > 0 ? 'bad' : 'watch') : 'good',
  }

  return {
    signal, lowStockItems, totalSkus: products.length, stockValueCost, stockValueRetail,
    bookingsToday, upcoming7, pendingBookings, openTasks, overdueTasks,
  }
}

export async function refreshOpsSignal(tenantId: string): Promise<OpsSignal> {
  const intel = await buildOpsIntel(tenantId)
  await publishSignal('ops', tenantId, intel.signal)
  return intel.signal
}
