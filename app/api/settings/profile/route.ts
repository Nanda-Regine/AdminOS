import { z } from 'zod'
import { withRoute, unwrap, badRequest } from '@/lib/api/withRoute'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildCachedSystemPrompt } from '@/lib/ai/buildSystemPrompt'
import { notifyTenant } from '@/lib/notifications/notify'
import { writeAuditLog, getClientIp } from '@/lib/security/audit'
import { syncStatutoryCalendar } from '@/lib/compliance/sync'
import { sastDate } from '@/lib/time/sast'
import type { Tenant } from '@/types/database'
import {
  BUSINESS_TYPE_VALUES, compact, employerRefMismatch,
  isVatNumber, isPayeRef, isSdlRef, isUifRef, isIncomeTaxRef, isCipcNumber, isBranchCode, isBankAccount,
} from '@/lib/business/profile'

/**
 * POST /api/settings/profile — the business's profile, identity and document
 * details, all stored on the tenant (columns + settings JSONB).
 *
 * Partial update: only fields present in the body change (onboarding sends
 * name + businessType; Bot Training sends faqs/policies/tone; the document
 * form sends address/VAT/bank). An empty string clears an optional field.
 *
 * Was: no validation (any string became the VAT number or bank account on
 * every invoice), no role check, raw DB errors. Bank details printed on
 * invoices are a fraud target, so a change is audited as critical and the
 * owner is alerted.
 */

const text = (max: number) => z.string().trim().max(max)
/** Forms post '' for untouched required fields; treat that as 'not sent'. */
const blankIsUnset = <T extends z.ZodTypeAny>(t: T) => z.preprocess((v) => (v === '' ? undefined : v), t)
/** '' clears the field; anything else must pass `ok`. Stored compacted when `normalise`. */
const ref = (ok: (s: string) => boolean, message: string, normalise = true) =>
  z.string().trim().max(40)
    .refine((s) => s === '' || ok(s), { message })
    .transform((s) => (normalise ? compact(s) : s.replace(/\s/g, '')))

const schema = z.object({
  name:          blankIsUnset(z.string().trim().min(2, 'Business name is too short').max(120).optional()),
  tradingName:   text(120).optional(),
  businessType:  blankIsUnset(z.enum(BUSINESS_TYPE_VALUES).optional()),
  country:       blankIsUnset(z.string().trim().length(2).optional()),
  language:      text(10).optional(),
  timezone:      text(60).optional(),
  whatsappNumber: text(20).optional(),
  contactEmail:  z.union([z.literal(''), z.string().trim().email('Enter a valid email address').max(200)]).optional(),
  contactPhone:  text(20).optional(),

  faqs:     text(20_000).optional(),
  policies: text(20_000).optional(),
  tone:     text(40).optional(),
  services: text(20_000).optional(),

  address:           text(300).optional(),
  vatNumber:         ref(isVatNumber, 'A SA VAT number is 10 digits starting with 4').optional(),
  bankName:          text(60).optional(),
  bankAccountHolder: text(120).optional(),
  bankAccountNumber: ref(isBankAccount, 'Account number should be 6–16 digits').optional(),
  bankBranchCode:    ref(isBranchCode, 'Branch code is 6 digits').optional(),

  registrationNumber: ref(isCipcNumber, 'CIPC numbers look like 2019/123456/07', false).optional(),
  incorporationDate:  z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a full date')]).optional()
    .refine((d) => !d || d <= sastDate(), { message: 'Incorporation date cannot be in the future' }),
  financialYearEndMonth: z.coerce.number().int().min(1).max(12).optional(),
  incomeTaxNumber: ref(isIncomeTaxRef, 'Income tax reference is 10 digits').optional(),
  payeReference:   ref(isPayeRef, 'PAYE reference is 10 digits starting with 7').optional(),
  sdlReference:    ref(isSdlRef, 'SDL reference is L followed by 9 digits').optional(),
  uifReference:    ref(isUifRef, 'UIF reference is U followed by 9 digits').optional(),
  payrollDay:      z.coerce.number().int().min(1).max(28).optional(),
})

// body key → settings key
const SETTINGS_KEYS = {
  tradingName: 'trading_name', contactEmail: 'contact_email', contactPhone: 'contact_phone',
  faqs: 'faqs', policies: 'policies', tone: 'tone', services: 'services',
  address: 'address', vatNumber: 'vat_number',
  bankName: 'bank_name', bankAccountHolder: 'bank_account_holder', bankAccountNumber: 'bank_account_number', bankBranchCode: 'bank_branch_code',
  registrationNumber: 'registration_number', incorporationDate: 'incorporation_date', financialYearEndMonth: 'financial_year_end_month',
  incomeTaxNumber: 'income_tax_number', payeReference: 'paye_reference', sdlReference: 'sdl_reference', uifReference: 'uif_number',
  payrollDay: 'payroll_day',
} as const satisfies Partial<Record<keyof z.infer<typeof schema>, string>>

const BANK_KEYS = ['bank_name', 'bank_account_holder', 'bank_account_number', 'bank_branch_code'] as const
const CALENDAR_KEYS = ['financial_year_end_month', 'incorporation_date'] as const

export const POST = withRoute(
  { action: 'settings.write', body: schema, rateLimit: 'api' },
  async ({ ctx, body, request }) => {
    const current = unwrap(await supabaseAdmin
      .from('tenants').select('settings, business_type').eq('id', ctx.tenantId).maybeSingle(), { required: true, what: 'Business' })
    const before = (current.settings ?? {}) as Record<string, unknown>

    const mismatch = employerRefMismatch(
      body.payeReference ?? (before.paye_reference as string | undefined),
      body.sdlReference ?? (before.sdl_reference as string | undefined),
      body.uifReference ?? (before.uif_number as string | undefined),
    )
    if (mismatch) throw badRequest(mismatch)

    const settings: Record<string, unknown> = { ...before }
    for (const [bodyKey, settingsKey] of Object.entries(SETTINGS_KEYS)) {
      const v = body[bodyKey as keyof typeof body]
      if (v !== undefined) settings[settingsKey] = v
    }

    const columns: Record<string, unknown> = { settings }
    if (body.name !== undefined) columns.name = body.name
    if (body.businessType !== undefined) columns.business_type = body.businessType
    if (body.country !== undefined) columns.country = body.country
    if (body.language !== undefined) columns.language_primary = body.language
    if (body.timezone !== undefined) columns.timezone = body.timezone
    if (body.whatsappNumber !== undefined) columns.whatsapp_number = body.whatsappNumber || null

    const updated = unwrap(await supabaseAdmin
      .from('tenants').update(columns).eq('id', ctx.tenantId)
      .select('id, name, business_type, country, language_primary, language_secondary, settings').single(), { required: true })

    // The AI's business context (name, type, FAQs, policies, tone).
    const systemPrompt = await buildCachedSystemPrompt(updated as Tenant)
    await supabaseAdmin.from('tenants')
      .update({ system_prompt_cache: systemPrompt, prompt_cached_at: new Date().toISOString() })
      .eq('id', ctx.tenantId)

    const changed = Object.keys(settings).filter((k) => JSON.stringify(settings[k]) !== JSON.stringify(before[k]))
    const bankChanged = BANK_KEYS.some((k) => changed.includes(k) && before[k])

    await writeAuditLog({
      tenantId: ctx.tenantId,
      actor: ctx.userId,
      action: bankChanged ? 'tenant.bank_details_changed' : 'tenant.settings.updated',
      resourceType: 'tenant',
      resourceId: ctx.tenantId,
      // Which fields changed, never their values (bank numbers stay out of the log).
      metadata: { role: ctx.role, changed, columns: Object.keys(columns).filter((k) => k !== 'settings') },
      ipAddress: getClientIp(request),
      critical: bankChanged,
    })

    if (bankChanged) {
      await notifyTenant(ctx.tenantId, {
        type: 'security',
        title: 'Invoice bank details changed',
        body: 'The bank account printed on your invoices was just changed in Settings. If you did not do this, change it back and review who has admin access.',
        actionUrl: '/dashboard/settings',
        whatsapp: true,
      })
    }

    if (body.businessType !== undefined || CALENDAR_KEYS.some((k) => changed.includes(k))) {
      await syncStatutoryCalendar(ctx.tenantId).catch((e) => console.error('calendar resync failed', ctx.tenantId, e))
    }

    return { success: true, changed }
  },
)
