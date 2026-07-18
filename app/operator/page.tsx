export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/context'

export default async function OperatorPage() {
  // Gated on the admins table via the one super-admin gate — was an
  // x-operator-secret header no browser sends, which made this page 404 for
  // everyone including operators. notFound() keeps the surface invisible.
  if (!await requireSuperAdmin()) notFound()

  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, name, plan, active, created_at')
    .order('created_at', { ascending: false })

  const { data: subscriptions } = await supabaseAdmin
    .from('subscriptions')
    .select('tenant_id, status, plan, addon_ring, addon_reach, addon_client_portal')

  const subMap = new Map((subscriptions ?? []).map(s => [s.tenant_id as string, s]))

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Operator Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">{tenants?.length ?? 0} tenants total</p>
        </div>

        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 border-b border-white/10">
              <tr>
                <th className="text-left px-4 py-3 text-white/60 font-medium">Tenant</th>
                <th className="text-left px-4 py-3 text-white/60 font-medium">Plan</th>
                <th className="text-left px-4 py-3 text-white/60 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-white/60 font-medium">Add-ons</th>
                <th className="text-left px-4 py-3 text-white/60 font-medium">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(tenants ?? []).map(tenant => {
                const sub = subMap.get(tenant.id as string)
                const addons = [
                  sub?.addon_ring && 'Ring',
                  sub?.addon_reach && 'Reach',
                  sub?.addon_client_portal && 'Portal',
                ].filter(Boolean)

                return (
                  <tr key={tenant.id as string} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium">{tenant.name as string}</p>
                      <p className="text-white/30 text-xs">{tenant.id as string}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-indigo-500/20 text-indigo-300">
                        {(sub?.plan ?? tenant.plan ?? 'trial') as string}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        tenant.active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {tenant.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {addons.length > 0
                          ? addons.map(a => (
                              <span key={a as string} className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/60">
                                {a as string}
                              </span>
                            ))
                          : <span className="text-white/20 text-xs">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">
                      {new Date(tenant.created_at as string).toLocaleDateString('en-ZA')}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/operator/${tenant.id as string}`}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
