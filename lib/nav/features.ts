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
import type { Permission } from '@/lib/auth/roleMatrix'
import {
  LayoutDashboard, Activity, Receipt, TrendingUp, Wallet, Banknote,
  MessageSquare, Users, Radio, Phone, Zap, PenLine,
  CalendarDays, CalendarClock, Package, Boxes, ClipboardList, FileText,
  UserCircle2, UsersRound, Scale, BookOpen,
  FileSignature, ShieldCheck, Gauge, HeartPulse, BarChart3, Landmark,
  GraduationCap, Library, HandHeart, PiggyBank, Megaphone,
  Puzzle, CreditCard, Settings, Bot, Clapperboard, Truck, BadgeCheck,
  ShieldAlert, PieChart,
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

/**
 * Mirrors the `business_type` enum in supabase/schema.sql — extended
 * 2026-08-17 (supabase/migrations/20260817_business_type_extend.sql) to add
 * the six marketed industries (app/page.tsx) that had no enum value yet.
 */
export type BusinessType =
  | 'school' | 'clinic' | 'ngo' | 'retail' | 'property'
  | 'legal' | 'logistics' | 'trades' | 'other'
  | 'creative' | 'consulting' | 'events' | 'cleaning' | 'accounting' | 'salons'

export interface Feature {
  href: string
  label: string
  icon: LucideIcon
  category: FeatureCategory
  /** Add-on that gates this feature (page still shows a billing gate). */
  requiresAddon?: 'ring' | 'reach'
  exact?: boolean
  /**
   * Industries this feature is relevant to. Omit for the universal spine —
   * invoicing, contacts, staff, compliance — which every business needs.
   *
   * Listing industries HIDES the feature from everyone else. Until now
   * business_type was captured at onboarding and then steered nothing, so a
   * construction firm and a spaza shop saw an identical 42-item sidebar,
   * including Stokvel and Creative Assets. That sameness is the seam an
   * experienced operator finds immediately.
   */
  industries?: BusinessType[]
  /**
   * The permission the page itself checks (any one of, when a list). Omit for
   * pages every member may open. Must match the page's own gate: the sidebar
   * used to show all 49 entries to every role, so a driver or receptionist
   * tapped into a wall of 404s for payroll, cashflow and settings.
   */
  requires?: Permission | Permission[]
}

export const FEATURES: Feature[] = [
  // ── Command ───────────────────────────────────────────────────────────────
  { href: '/dashboard',                  label: 'Command Center', icon: LayoutDashboard, category: 'Command', exact: true },
  { href: '/dashboard/getting-started',  label: 'Getting Started', icon: GraduationCap,  category: 'Command', requires: 'manage_settings' },
  { href: '/dashboard/workflow-monitor', label: 'Automations',    icon: Activity,        category: 'Command', requires: 'view_analytics' },
  { href: '/dashboard/analytics',        label: 'Analytics',      icon: BarChart3,       category: 'Command', requires: 'view_analytics' },

  // ── Get Paid (Money) ──────────────────────────────────────────────────────
  { href: '/dashboard/money',    label: 'Cash Cockpit',  icon: Wallet,   category: 'Get Paid', requires: 'view_financials' },
  { href: '/dashboard/invoices', label: 'Invoices & AR', icon: Receipt,  category: 'Get Paid', requires: 'manage_invoices' },
  { href: '/dashboard/cashflow', label: 'Cashflow',      icon: TrendingUp, category: 'Get Paid', requires: 'view_financials' },
  { href: '/dashboard/expenses', label: 'Expenses & AP', icon: Wallet,   category: 'Get Paid', requires: 'view_financials' },
  { href: '/dashboard/payroll',  label: 'Payroll',       icon: Banknote, category: 'Get Paid', requires: 'view_payroll' },
  { href: '/dashboard/money/reports', label: 'Accountant Reports', icon: FileText, category: 'Get Paid', requires: 'view_financials' },

  // ── Win Work (Sales) ──────────────────────────────────────────────────────
  { href: '/dashboard/sales',        label: 'Sales Cockpit', icon: TrendingUp,   category: 'Win Work', requires: 'view_analytics' },
  { href: '/dashboard/inbox',        label: 'Inbox',        icon: MessageSquare, category: 'Win Work', requires: 'view_communications' },
  { href: '/dashboard/contacts',     label: 'Contacts',     icon: Users,         category: 'Win Work', requires: 'manage_contacts' },
  { href: '/dashboard/reach',        label: 'Reach',        icon: Radio,         category: 'Win Work', requiresAddon: 'reach', requires: 'send_broadcasts' },
  { href: '/dashboard/ring',         label: 'Ring',         icon: Phone,         category: 'Win Work', requiresAddon: 'ring', requires: 'view_communications' },
  { href: '/dashboard/sequences',    label: 'Sequences',    icon: Zap,           category: 'Win Work', requires: 'send_broadcasts' },
  { href: '/dashboard/email-studio', label: 'Email Studio', icon: PenLine,       category: 'Win Work', requires: 'view_analytics' },

  // ── Deliver (Ops) ─────────────────────────────────────────────────────────
  { href: '/dashboard/ops',       label: 'Ops Cockpit', icon: Boxes,       category: 'Deliver', requires: 'manage_inventory' },
  { href: '/dashboard/bookings',  label: 'Bookings',  icon: CalendarClock, category: 'Deliver', requires: 'manage_contacts' },
  { href: '/dashboard/calendar',  label: 'Schedule',  icon: CalendarDays,  category: 'Deliver', requires: 'approve_leave' },
  { href: '/dashboard/suppliers', label: 'Suppliers', icon: Truck,        category: 'Deliver', requires: 'manage_inventory' },
  { href: '/dashboard/inventory', label: 'Inventory', icon: Package,       category: 'Deliver', industries: ['retail','trades','logistics','clinic','school','ngo','cleaning','salons'], requires: 'manage_inventory' },
  { href: '/dashboard/tasks',     label: 'Tasks',     icon: ClipboardList, category: 'Deliver' },
  { href: '/dashboard/documents', label: 'Documents', icon: FileText,      category: 'Deliver', requires: 'manage_documents' },
  // 'creative' used to arrive here only via the 'other' catch-all (Creative &
  // Media had no dedicated business_type value before 2026-08-17) — keep
  // 'other' too so nothing already relying on that catch-all regresses.
  { href: '/dashboard/creative-assets', label: 'Creative Assets', icon: Clapperboard, category: 'Deliver', industries: ['creative','other','property','ngo'], requires: 'manage_documents' },

  // ── Team (People) ─────────────────────────────────────────────────────────
  { href: '/dashboard/people',   label: 'People Cockpit', icon: UsersRound, category: 'Team', requires: ['approve_leave', 'manage_staff', 'view_payroll'] },
  { href: '/dashboard/staff',    label: 'Staff',        icon: UserCircle2, category: 'Team', requires: 'manage_staff' },
  { href: '/dashboard/team',     label: 'Team Ops',     icon: UsersRound,  category: 'Team', requires: ['approve_leave', 'manage_staff'] },
  { href: '/dashboard/ir-log',   label: 'IR & Discipline', icon: Scale,    category: 'Team', requires: 'manage_staff' },
  { href: '/dashboard/handbook', label: 'Handbook & SOPs', icon: BookOpen, category: 'Team' },

  // ── Govern (Governance) ───────────────────────────────────────────────────
  { href: '/dashboard/governance',          label: 'Governance Cockpit', icon: ShieldCheck, category: 'Govern', requires: 'view_financials' },
  { href: '/dashboard/contracts',           label: 'Contracts',  icon: FileSignature, category: 'Govern', requires: 'view_financials' },
  { href: '/dashboard/compliance',          label: 'Compliance Calendar', icon: CalendarClock, category: 'Govern', requires: 'view_financials' },
  { href: '/dashboard/licenses',            label: 'Licences & Permits', icon: BadgeCheck, category: 'Govern', requires: 'manage_staff' },
  // Everyone may report (OHSA); the page shows HR the register, others their own reports.
  { href: '/dashboard/safety',              label: 'Safety Incidents', icon: ShieldAlert, category: 'Govern' },
  { href: '/dashboard/settings/employment-equity', label: 'Employment Equity', icon: PieChart, category: 'Govern', requires: 'manage_staff' },
  { href: '/dashboard/settings/compliance', label: 'POPIA & Data',        icon: ShieldCheck,   category: 'Govern', requires: 'manage_settings' },
  { href: '/dashboard/valuation',           label: 'Valuation',  icon: Gauge,         category: 'Govern', requires: 'view_financials' },
  { href: '/dashboard/health',              label: 'Health',     icon: HeartPulse,    category: 'Govern', requires: 'view_analytics' },
  { href: '/dashboard/board-pack',          label: 'Board Pack', icon: Landmark,      category: 'Govern', requires: 'view_financials' },

  // ── Grow ──────────────────────────────────────────────────────────────────
  { href: '/dashboard/langa',          label: 'Langa (AI mentor)', icon: GraduationCap, category: 'Grow', requires: 'view_analytics' },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base',    icon: Library,       category: 'Grow' },
  { href: '/dashboard/announcements',  label: 'Announcements',     icon: Megaphone,     category: 'Grow' },
  { href: '/dashboard/community',      label: 'Community',         icon: HandHeart,     category: 'Grow', requires: 'view_analytics' },
  { href: '/dashboard/stokvel',        label: 'Stokvel',           icon: PiggyBank,     category: 'Grow', industries: ['retail','ngo','trades','other'], requires: 'view_financials' },

  // ── Setup (footer) ────────────────────────────────────────────────────────
  { href: '/dashboard/settings/autonomy', label: 'Autonomy',    icon: Bot,        category: 'Setup', requires: 'manage_settings' },
  { href: '/dashboard/integrations',     label: 'Integrations', icon: Puzzle,     category: 'Setup', requires: 'manage_settings' },
  { href: '/dashboard/settings/billing', label: 'Billing',      icon: CreditCard, category: 'Setup', requires: 'manage_billing' },
  { href: '/dashboard/settings',         label: 'Settings',     icon: Settings,   category: 'Setup', requires: 'manage_settings' },
]

/**
 * Is this feature relevant to the given business?
 *
 * Fails OPEN, deliberately: an unset or unrecognised business_type shows
 * everything. Most existing tenants have never set one, and hiding a paid
 * feature from someone who is entitled to it is a far worse failure than
 * showing one they don't need.
 */
export function isFeatureVisible(f: Feature, businessType?: BusinessType | null): boolean {
  if (!f.industries) return true
  if (!businessType) return true
  return f.industries.includes(businessType)
}

/**
 * May this caller open the feature? Fails CLOSED, unlike the industry filter:
 * a page someone cannot open is a dead link, not a hidden entitlement.
 * `permissions` undefined means "not role-scoped" (super-admin / operator).
 */
export function canOpenFeature(f: Feature, permissions?: readonly string[] | null): boolean {
  if (!f.requires || permissions == null) return true
  const need = Array.isArray(f.requires) ? f.requires : [f.requires]
  return need.some(p => permissions.includes(p))
}

/** Features grouped by category, in value-chain order, scoped to the business and the caller's role. */
export function featuresByCategory(
  businessType?: BusinessType | null,
  permissions?: readonly string[] | null,
): { key: FeatureCategory; blurb: string; items: Feature[] }[] {
  return CATEGORY_ORDER
    .map(({ key, blurb }) => ({
      key,
      blurb,
      items: FEATURES.filter(f => f.category === key && isFeatureVisible(f, businessType) && canOpenFeature(f, permissions)),
    }))
    .filter(g => g.items.length > 0)
}
