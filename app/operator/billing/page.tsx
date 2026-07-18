export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireSuperAdmin } from '@/lib/auth/context'
import { BillingCatalogueEditor } from '@/components/operator/BillingCatalogueEditor'

// Operator-only live pricing editor. Gated on the admins table via the one
// super-admin gate; notFound() keeps the surface invisible to non-operators.
export default async function OperatorBillingPage() {
  if (!await requireSuperAdmin()) notFound()

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link href="/operator" className="text-xs text-white/40 hover:text-white/70">← Operator</Link>
          <h1 className="text-2xl font-bold mt-2">Billing Catalogue</h1>
          <p className="text-white/40 text-sm mt-1">
            Edit plan &amp; add-on prices and the bundling ladder. Changes are live immediately — no deploy.
          </p>
        </div>
        <BillingCatalogueEditor />
      </div>
    </div>
  )
}
