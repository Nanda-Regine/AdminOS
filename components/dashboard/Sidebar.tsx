'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Users, UserCircle2, FileText,
  BarChart3, Settings, CalendarDays, Receipt, PenLine, Activity, LogOut,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/staff', label: 'Staff', icon: UserCircle2 },
  { href: '/dashboard/invoices', label: 'Invoices', icon: Receipt },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText },
  { href: '/dashboard/email-studio', label: 'Email Studio', icon: PenLine },
  { href: '/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/workflow-monitor', label: 'Workflows', icon: Activity },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 bg-[#0A0F2C] text-white flex flex-col h-screen fixed left-0 top-0 z-30 border-r border-white/5">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[#C9A84C] rounded-lg flex items-center justify-center">
            <span className="font-bold text-[#0A0F2C] text-sm tracking-tight">AO</span>
          </div>
          <div>
            <span className="font-bold text-sm tracking-tight text-white">AdminOS</span>
            <p className="text-[10px] text-white/30 leading-none">AI Business OS</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                isActive
                  ? 'bg-[#2D4A22] text-[#C9A84C] font-medium'
                  : 'text-white/40 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Agent status pills */}
      <div className="px-4 py-3 border-t border-white/5">
        <p className="text-[10px] text-white/20 uppercase tracking-wider mb-2">Active Agents</p>
        <div className="flex flex-wrap gap-1">
          {['Alex', 'Chase', 'Care', 'Doc', 'Insight', 'Pen'].map((a) => (
            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2D4A22]/60 text-[#C9A84C]">{a}</span>
          ))}
        </div>
      </div>

      {/* Sign out */}
      <div className="px-4 py-4 border-t border-white/5">
        <Link
          href="/api/auth/signout"
          className="flex items-center gap-2 text-white/30 hover:text-white/70 text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Link>
      </div>
    </aside>
  )
}
