'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, MessageSquare, Users, UserCircle2, FileText,
  BarChart3, Settings, CalendarDays, Receipt, PenLine, Activity,
  LogOut, Phone, Radio, Zap, CreditCard, Puzzle,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',                    label: 'Overview',     icon: LayoutDashboard, exact: true },
  { href: '/dashboard/inbox',              label: 'Inbox',        icon: MessageSquare },
  { href: '/dashboard/contacts',           label: 'Contacts',     icon: Users },
  { href: '/dashboard/sequences',          label: 'Sequences',    icon: Zap },
  { href: '/dashboard/reach',              label: 'Reach',        icon: Radio },
  { href: '/dashboard/ring',               label: 'Ring',         icon: Phone },
  { href: '/dashboard/invoices',           label: 'Invoices',     icon: Receipt },
  { href: '/dashboard/documents',          label: 'Documents',    icon: FileText },
  { href: '/dashboard/staff',              label: 'Staff',        icon: UserCircle2 },
  { href: '/dashboard/email-studio',       label: 'Email Studio', icon: PenLine },
  { href: '/dashboard/calendar',           label: 'Calendar',     icon: CalendarDays },
  { href: '/dashboard/analytics',          label: 'Analytics',    icon: BarChart3 },
  { href: '/dashboard/integrations',        label: 'Integrations', icon: Puzzle },
  { href: '/dashboard/workflow-monitor',   label: 'Workflows',    icon: Activity },
  { href: '/dashboard/settings/billing',   label: 'Billing',      icon: CreditCard },
  { href: '/dashboard/settings',           label: 'Settings',     icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-60 flex flex-col h-screen fixed left-0 top-0 z-30 border-r"
      style={{ background: 'var(--navy)', borderColor: 'var(--border)' }}>

      {/* Logo */}
      <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center gradient-gold shrink-0">
            <span className="font-bold text-[#0A0F2C] text-sm tracking-tight">AO</span>
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight" style={{ color: 'var(--text-primary)' }}>
              AdminOS
            </span>
            <p className="text-[10px] leading-none" style={{ color: 'var(--text-muted)' }}>AI Business OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
              style={isActive ? {
                background: 'var(--indigo-muted)',
                color: 'var(--indigo-light)',
                fontWeight: 500,
              } : {
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'
                  ;(e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
                  ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                }
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Agent status */}
      <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
          Active Agents
        </p>
        <div className="flex flex-wrap gap-1">
          {['Alex', 'Chase', 'Care', 'Doc', 'Insight', 'Pen'].map((a) => (
            <span
              key={a}
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--indigo-muted)', color: 'var(--indigo-light)' }}
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="px-4 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2 text-sm transition-colors w-full"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
