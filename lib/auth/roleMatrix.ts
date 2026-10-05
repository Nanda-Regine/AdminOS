/**
 * Role matrix — the canonical answer to "which role may do what" in AdminOS.
 *
 * Three layers, in order:
 *
 *   ROLES        the six roles that exist. Nothing else is a role. (Routes that
 *                checked for 'hr_manager' or 'super_admin' were checking for
 *                roles no tenant can ever hold — super-admin is the `admins`
 *                table, see lib/auth/context.ts, not a tenant role.)
 *   PERMISSIONS  the capabilities stored on each tenant's `roles` row. Tenants
 *                may customise a role's permission list, so routes must check
 *                permissions, never role names.
 *   ACTIONS      what a route does, mapped to the one permission it needs —
 *                or 'member' when any role in the tenant may do it (own data:
 *                clock-in, own payslip, mark own notification read).
 *
 * A route declares an action (`withRoute({ action: 'payroll.distribute' })`)
 * and never names a role or permission itself. Changing who may distribute
 * payroll is then a one-line edit here, reviewed in one place.
 *
 * This file has no imports on purpose: tests load it directly under
 * `node --experimental-strip-types`, which cannot resolve the `@/` alias.
 */

export const ROLES = ['owner', 'admin', 'manager', 'staff', 'field_agent', 'client'] as const
export type RoleName = (typeof ROLES)[number]

export const ALL_PERMISSIONS = [
  'manage_staff',
  'view_financials',
  'approve_leave',
  'view_payroll',
  'manage_settings',
  'manage_billing',
  'view_analytics',
  'send_broadcasts',
  'manage_invoices',
  'manage_contacts',
  'manage_documents',
  'manage_inventory',
  'view_own_data_only',
  'view_communications',
] as const
export type Permission = (typeof ALL_PERMISSIONS)[number]

/** Seeded onto each new tenant's `roles` rows (seedDefaultRoles). */
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  owner: [
    'manage_staff', 'view_financials', 'approve_leave', 'view_payroll',
    'manage_settings', 'manage_billing', 'view_analytics', 'send_broadcasts',
    'manage_invoices', 'manage_contacts', 'manage_documents', 'manage_inventory',
    'view_communications',
  ],
  admin: [
    'manage_staff', 'view_financials', 'approve_leave', 'view_payroll',
    'manage_settings', 'view_analytics', 'send_broadcasts',
    'manage_invoices', 'manage_contacts', 'manage_documents', 'manage_inventory',
    'view_communications',
  ],
  manager: [
    'view_financials', 'approve_leave', 'view_analytics',
    'manage_invoices', 'manage_contacts', 'manage_documents', 'manage_inventory',
  ],
  staff: [
    'manage_contacts', 'manage_documents', 'view_own_data_only',
  ],
  field_agent: [
    'manage_contacts', 'view_own_data_only',
  ],
  client: [
    'view_own_data_only',
  ],
}

/** Any role in the tenant. Use only for actions on the caller's own data. */
export const MEMBER = 'member' as const
export type Requirement = Permission | typeof MEMBER

/**
 * Every authorised action in the app. Grouped by the domain sweeps in
 * BUILD_JOURNEY_ADMINOS.md Session 16b Phase 2; each domain session confirms
 * and extends its block before migrating routes onto withRoute.
 */
export const ACTIONS = {
  // ── Money ────────────────────────────────────────────────────────────────
  'invoices.read':        'manage_invoices',
  'invoices.write':       'manage_invoices',
  'money.read':           'view_financials',   // cashflow, valuation, money overview, reports
  'money.write':          'view_financials',   // quick sale, categorisation, profit-first
  'expenses.submit':      MEMBER,              // anyone can submit a claim…
  'expenses.approve':     'view_financials',   // …only finance approves it
  'expenses.read_all':    'view_financials',   // everyone else sees only their own claims
  'payroll.read':         'view_payroll',
  'payroll.run':          'view_payroll',
  'payroll.distribute':   'view_payroll',
  'payslip.read_own':     MEMBER,
  'inventory.read':       'manage_inventory',
  'inventory.write':      'manage_inventory',
  // Procurement sits with stock: same permission the suppliers page checks.
  'suppliers.read':       'manage_inventory',
  'suppliers.write':      'manage_inventory',

  // ── People / HR ─────────────────────────────────────────────────────────
  'staff.read':           'manage_staff',      // staff rows carry salary + ID numbers
  'staff.write':          'manage_staff',
  'leave.request':        MEMBER,
  'leave.approve':        'approve_leave',
  'clock.self':           MEMBER,              // own clock events; HR (staff.write) may act for anyone
  'hr.records':           'manage_staff',      // disciplinary, performance, EE, IR log, safety register
  'safety.report':        MEMBER,              // OHSA: anyone can report an incident…
  'shifts.read':          MEMBER,              // the roster is the team's to see…
  'shifts.write':         'manage_staff',      // …HR builds it
  'announcements.read':   MEMBER,
  'announcements.write':  'send_broadcasts',
  'handbook.read':        MEMBER,
  'handbook.write':       'manage_staff',      // policies are HR documents
  'handbook.acknowledge': MEMBER,

  // ── Customers & comms ───────────────────────────────────────────────────
  'contacts.read':        'manage_contacts',
  'contacts.write':       'manage_contacts',
  'communications.read':  'view_communications', // inbox, ring
  'communications.reply': 'view_communications',
  'broadcasts.send':      'send_broadcasts',     // reach campaigns, push to colleagues

  // ── Ops ─────────────────────────────────────────────────────────────────
  // Tasks have no dedicated permission yet (see memory
  // adminos-page-level-authorization-gap) — every member can work tasks.
  'tasks.read':           MEMBER,
  'tasks.write':          MEMBER,
  'documents.read':       'manage_documents',
  'documents.write':      'manage_documents',

  // ── Insight / settings ──────────────────────────────────────────────────
  'analytics.read':       'view_analytics',
  'settings.write':       'manage_settings',
  'billing.manage':       'manage_billing',

  // ── Self-service ────────────────────────────────────────────────────────
  'notifications.own':    MEMBER,
  'academy.learn':        MEMBER,
  'profile.own':          MEMBER,
} as const satisfies Record<string, Requirement>

export type Action = keyof typeof ACTIONS

export function requirementFor(action: Action): Requirement {
  return ACTIONS[action]
}

/**
 * The single authorisation predicate. `permissions` are the caller's
 * permissions in *this* tenant (from their `roles` row, already resolved by
 * getContext). Super-admins pass everything.
 */
export function can(
  caller: { permissions: readonly string[]; isSuperAdmin?: boolean },
  action: Action,
): boolean {
  if (caller.isSuperAdmin) return true
  const need = ACTIONS[action]
  if (need === MEMBER) return true
  return caller.permissions.includes(need)
}

/** Which default roles may perform an action — for docs, tests and UI hints. */
export function defaultRolesFor(action: Action): RoleName[] {
  return ROLES.filter((role) => can({ permissions: DEFAULT_ROLE_PERMISSIONS[role] }, action))
}

export function isRoleName(value: unknown): value is RoleName {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
