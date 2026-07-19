/**
 * THE FEATURE REGISTRY — one typed source of truth for every AdminOS surface.
 * (Ported from BB-MotherShip-Deluxe `lib/nav/features.ts`.)
 *
 * This single array drives the sidebar, the command launcher, and (later) role
 * / plan gating. Pages are grouped into the VALUE CHAIN — the story of running a
 * business — so the app reads as one operating system, not an alphabet of pages.
 * Adding a page = one entry here. Client-safe (data + helpers only, no imports
 * that touch the server).
 */

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, Activity, Receipt, TrendingUp, Wallet, Banknote,
  MessageSquare, Users, Radio, Phone, Zap, PenLine,
  CalendarDays, CalendarClock, Package, Boxes, ClipboardList, FileText,
  UserCircle2, UsersRound, Scale, BookOpen,
  FileSignature, ShieldCheck, Gauge, HeartPulse, BarChart3, Landmark,
  GraduationCap, Library, HandHeart, PiggyBank, Megaphone,
  Puzzle, CreditCard, Settings, Bot,
} from 'lucide-react'

export type FeatureCategory =
  | 'Command' | 'Get Paid' | 'Win Work' | 'Deliver' | 'Team' | 'Govern' | 'Grow' | 'Setup'

/** Category order + one-line intent (shown as the group's story). */
export const CATEGORY_ORDER: { key: FeatureCategory; blurb: string }[] = [
  { key: 'Command',  blurb: 'Run the day' },
  { key: 'Get Paid', blurb: 'Money in, money out' },
  { key: 'Win Work', blurb: 'Attract & convert' },
  { key: 'Deliver',  blurb: 'Do the work' },
  { key: 'Team',     blurb: 'Run the people' },
  { key: 'Govern',   blurb: 'Stay safe & investor-ready' },
  { key: 'Grow',     blurb: 'Level up' },
  { key: 'Setup',    blurb: 'Configure' },
]

export interface Feature {
  href: string
  label: string
  icon: LucideIcon
  category: FeatureCategory
  /** Add-on that gates this feature (page still shows a billing gate). */
  requiresAddon?: 'ring' | 'reach'
  exact?: boolean
}

export const FEATURES: Feature[] = [
  // ── Command ───────────────────────────────────────────────────────────────
  { href: '/dashboard',                  label: 'Command Center', icon: LayoutDashboard, category: 'Command', exact: true },
  { href: '/dashboard/workflow-monitor', label: 'Automations',    icon: Activity,        category: 'Command' },
  { href: '/dashboard/analytics',        label: 'Analytics',      icon: BarChart3,       category: 'Command' },

  // ── Get Paid (Money) ──────────────────────────────────────────────────────
  { href: '/dashboard/money',    label: 'Cash Cockpit',  icon: Wallet,   category: 'Get Paid' },
  { href: '/dashboard/invoices', label: 'Invoices & AR', icon: Receipt,  category: 'Get Paid' },
  { href: '/dashboard/cashflow', label: 'Cashflow',      icon: TrendingUp, category: 'Get Paid' },
  { href: '/dashboard/expenses', label: 'Expenses & AP', icon: Wallet,   category: 'Get Paid' },
  { href: '/dashboard/payroll',  label: 'Payroll',       icon: Banknote, category: 'Get Paid' },
  { href: '/dashboard/money/reports', label: 'Accountant Reports', icon: FileText, category: 'Get Paid' },

  // ── Win Work (Sales) ──────────────────────────────────────────────────────
  { href: '/dashboard/sales',        label: 'Sales Cockpit', icon: TrendingUp,   category: 'Win Work' },
  { href: '/dashboard/inbox',        label: 'Inbox',        icon: MessageSquare, category: 'Win Work' },
  { href: '/dashboard/contacts',     label: 'Contacts',     icon: Users,         category: 'Win Work' },
  { href: '/dashboard/reach',        label: 'Reach',        icon: Radio,         category: 'Win Work', requiresAddon: 'reach' },
  { href: '/dashboard/ring',         label: 'Ring',         icon: Phone,         category: 'Win Work', requiresAddon: 'ring' },
  { href: '/dashboard/sequences',    label: 'Sequences',    icon: Zap,           category: 'Win Work' },
  { href: '/dashboard/email-studio', label: 'Email Studio', icon: PenLine,       category: 'Win Work' },

  // ── Deliver (Ops) ─────────────────────────────────────────────────────────
  { href: '/dashboard/ops',       label: 'Ops Cockpit', icon: Boxes,       category: 'Deliver' },
  { href: '/dashboard/bookings',  label: 'Bookings',  icon: CalendarClock, category: 'Deliver' },
  { href: '/dashboard/calendar',  label: 'Calendar',  icon: CalendarDays,  category: 'Deliver' },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package,       category: 'Deliver' },
  { href: '/dashboard/tasks',     label: 'Tasks',     icon: ClipboardList, category: 'Deliver' },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText,      category: 'Deliver' },

  // ── Team (People) ─────────────────────────────────────────────────────────
  { href: '/dashboard/people',   label: 'People Cockpit', icon: UsersRound, category: 'Team' },
  { href: '/dashboard/staff',    label: 'Staff',        icon: UserCircle2, category: 'Team' },
  { href: '/dashboard/team',     label: 'Team Ops',     icon: UsersRound,  category: 'Team' },
  { href: '/dashboard/ir-log',   label: 'IR & Discipline', icon: Scale,    category: 'Team' },
  { href: '/dashboard/handbook', label: 'Handbook & SOPs', icon: BookOpen, category: 'Team' },

  // ── Govern (Governance) ───────────────────────────────────────────────────
  { href: '/dashboard/governance',          label: 'Governance Cockpit', icon: ShieldCheck, category: 'Govern' },
  { href: '/dashboard/contracts',           label: 'Contracts',  icon: FileSignature, category: 'Govern' },
  { href: '/dashboard/settings/compliance', label: 'Compliance', icon: ShieldCheck,   category: 'Govern' },
  { href: '/dashboard/valuation',           label: 'Valuation',  icon: Gauge,         category: 'Govern' },
  { href: '/dashboard/health',              label: 'Health',     icon: HeartPulse,    category: 'Govern' },
  { href: '/dashboard/board-pack',          label: 'Board Pack', icon: Landmark,      category: 'Govern' },

  // ── Grow ──────────────────────────────────────────────────────────────────
  { href: '/dashboard/langa',          label: 'Langa (AI mentor)', icon: GraduationCap, category: 'Grow' },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base',    icon: Library,       category: 'Grow' },
  { href: '/dashboard/announcements',  label: 'Announcements',     icon: Megaphone,     category: 'Grow' },
  { href: '/dashboard/community',      label: 'Community',         icon: HandHeart,     category: 'Grow' },
  { href: '/dashboard/stokvel',        label: 'Stokvel',           icon: PiggyBank,     category: 'Grow' },

  // ── Setup (footer) ────────────────────────────────────────────────────────
  { href: '/dashboard/settings/autonomy', label: 'Autonomy',    icon: Bot,        category: 'Setup' },
  { href: '/dashboard/integrations',     label: 'Integrations', icon: Puzzle,     category: 'Setup' },
  { href: '/dashboard/settings/billing', label: 'Billing',      icon: CreditCard, category: 'Setup' },
  { href: '/dashboard/settings',         label: 'Settings',     icon: Settings,   category: 'Setup' },
]

/** Features grouped by category, in value-chain order. */
export function featuresByCategory(): { key: FeatureCategory; blurb: string; items: Feature[] }[] {
  return CATEGORY_ORDER
    .map(({ key, blurb }) => ({ key, blurb, items: FEATURES.filter(f => f.category === key) }))
    .filter(g => g.items.length > 0)
}
