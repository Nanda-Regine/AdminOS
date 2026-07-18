'use client'

import { useEffect, useState } from 'react'

type Plan = {
  slug: string
  display_name: string
  price_monthly: number
  price_annual: number | null
  included_addons: string[] | null
  active: boolean
}
type Addon = {
  slug: string
  display_name: string
  description: string | null
  price_monthly: number
  price_annual: number | null
  active: boolean
}
type Catalogue = {
  plans: Plan[]
  addons: Addon[]
  addonSlugs: string[]
  paystackConfigured: Record<string, boolean>
}

export function BillingCatalogueEditor() {
  const [data, setData] = useState<Catalogue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/billing-catalogue')
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(setData)
      .catch(e => setError(e.message))
  }, [])

  function setPlan(slug: string, patch: Partial<Plan>) {
    setData(d => d && { ...d, plans: d.plans.map(p => p.slug === slug ? { ...p, ...patch } : p) })
  }
  function setAddon(slug: string, patch: Partial<Addon>) {
    setData(d => d && { ...d, addons: d.addons.map(a => a.slug === slug ? { ...a, ...patch } : a) })
  }

  async function save(type: 'plan' | 'addon', slug: string) {
    if (!data) return
    setSaving(slug); setSaved(null); setError(null)
    const row: Plan | Addon | undefined = type === 'plan'
      ? data.plans.find(p => p.slug === slug)
      : data.addons.find(a => a.slug === slug)
    if (!row) { setSaving(null); return }
    const body: Record<string, unknown> = type === 'plan'
      ? { type, slug, price_monthly: Number((row as Plan).price_monthly), price_annual: (row as Plan).price_annual === null ? null : Number((row as Plan).price_annual), included_addons: (row as Plan).included_addons ?? [], active: row.active }
      : { type, slug, display_name: (row as Addon).display_name, description: (row as Addon).description ?? '', price_monthly: Number((row as Addon).price_monthly), price_annual: (row as Addon).price_annual === null ? null : Number((row as Addon).price_annual), active: row.active }
    try {
      const res = await fetch('/api/admin/billing-catalogue', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Save failed')
      setSaved(slug)
      setTimeout(() => setSaved(s => s === slug ? null : s), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(null)
    }
  }

  if (error && !data) return <p className="text-red-400 text-sm">Error: {error}</p>
  if (!data) return <p className="text-white/40 text-sm">Loading catalogue…</p>

  const inputCls = 'bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm w-28 text-white'
  const num = (v: number | null) => v === null ? '' : String(v)

  return (
    <div className="space-y-10">
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Plans */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Plans &amp; bundling</h2>
        <div className="space-y-3">
          {data.plans.map(plan => (
            <div key={plan.slug} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="w-28 font-semibold capitalize">{plan.display_name}</div>
                <label className="text-xs text-white/50">Monthly R
                  <input type="number" className={inputCls} value={num(plan.price_monthly)}
                    onChange={e => setPlan(plan.slug, { price_monthly: Number(e.target.value) })} />
                </label>
                <label className="text-xs text-white/50">Annual R
                  <input type="number" className={inputCls} value={num(plan.price_annual)}
                    onChange={e => setPlan(plan.slug, { price_annual: e.target.value === '' ? null : Number(e.target.value) })} />
                </label>
                <label className="text-xs text-white/50 flex items-center gap-1">
                  <input type="checkbox" checked={plan.active} onChange={e => setPlan(plan.slug, { active: e.target.checked })} /> active
                </label>
                <button onClick={() => save('plan', plan.slug)} disabled={saving === plan.slug}
                  className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/80 hover:bg-indigo-500 disabled:opacity-50">
                  {saving === plan.slug ? 'Saving…' : saved === plan.slug ? 'Saved ✓' : 'Save'}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                <span className="text-xs text-white/40">Bundled add-ons:</span>
                {data.addonSlugs.map(slug => {
                  const on = (plan.included_addons ?? []).includes(slug)
                  return (
                    <label key={slug} className="text-xs flex items-center gap-1 text-white/70">
                      <input type="checkbox" checked={on}
                        onChange={e => {
                          const cur = new Set(plan.included_addons ?? [])
                          if (e.target.checked) cur.add(slug); else cur.delete(slug)
                          setPlan(plan.slug, { included_addons: [...cur] })
                        }} />
                      {slug}
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Add-ons */}
      <section>
        <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3">Add-ons</h2>
        <div className="space-y-3">
          {data.addons.map(addon => (
            <div key={addon.slug} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-center gap-4">
                <input className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-sm w-36 text-white font-semibold"
                  value={addon.display_name} onChange={e => setAddon(addon.slug, { display_name: e.target.value })} />
                <label className="text-xs text-white/50">Monthly R
                  <input type="number" className={inputCls} value={num(addon.price_monthly)}
                    onChange={e => setAddon(addon.slug, { price_monthly: Number(e.target.value) })} />
                </label>
                <label className="text-xs text-white/50">Annual R
                  <input type="number" className={inputCls} value={num(addon.price_annual)}
                    onChange={e => setAddon(addon.slug, { price_annual: e.target.value === '' ? null : Number(e.target.value) })} />
                </label>
                <label className="text-xs text-white/50 flex items-center gap-1">
                  <input type="checkbox" checked={addon.active} onChange={e => setAddon(addon.slug, { active: e.target.checked })} /> active
                </label>
                <button onClick={() => save('addon', addon.slug)} disabled={saving === addon.slug}
                  className="ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-500/80 hover:bg-indigo-500 disabled:opacity-50">
                  {saving === addon.slug ? 'Saving…' : saved === addon.slug ? 'Saved ✓' : 'Save'}
                </button>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <input className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/80"
                  value={addon.description ?? ''} onChange={e => setAddon(addon.slug, { description: e.target.value })} />
                {!data.paystackConfigured[addon.slug] && (
                  <span className="text-xs text-amber-400 whitespace-nowrap" title="No PAYSTACK_PLAN_ADMINOS_* env for this slug — not chargeable until a Paystack plan exists">
                    ⚠ no Paystack plan
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-white/30 mt-3">
          Display &amp; intent only. The amount actually charged lives in the Paystack plan on the Mirembe hub — update it there to match.
        </p>
      </section>
    </div>
  )
}
