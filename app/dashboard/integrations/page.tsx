import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/dashboard/TopBar'
import { getLoadSheddingStatus } from '@/lib/integrations/loadshedding'
import { getWeather } from '@/lib/integrations/weather'
import { getFxRates } from '@/lib/integrations/fx-rates'
import { Zap, Cloud, TrendingUp, Phone, RefreshCw } from 'lucide-react'
import { PhoneChecker } from '@/components/integrations/PhoneChecker'

export const revalidate = 300 // 5-min cache for the page

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all three in parallel
  const [shedding, weather, fx] = await Promise.all([
    getLoadSheddingStatus(),
    getWeather('johannesburg'),
    getFxRates('ZAR'),
  ])

  const fxPairs = [
    { code: 'USD', flag: '🇺🇸', name: 'US Dollar' },
    { code: 'EUR', flag: '🇪🇺', name: 'Euro' },
    { code: 'GBP', flag: '🇬🇧', name: 'British Pound' },
    { code: 'CNY', flag: '🇨🇳', name: 'Chinese Yuan' },
    { code: 'KES', flag: '🇰🇪', name: 'Kenyan Shilling' },
    { code: 'NGN', flag: '🇳🇬', name: 'Nigerian Naira' },
  ]

  return (
    <div>
      <TopBar title="Integrations" subtitle="Live data feeds — load shedding, weather, FX rates, phone tools" />
      <div className="p-6 space-y-6">

        {/* Top row: load shedding + weather */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Load Shedding */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${shedding.color}20` }}>
                <Zap className="w-4 h-4" style={{ color: shedding.color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Load Shedding</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Source: Eskom</p>
              </div>
              <div className="ml-auto flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <RefreshCw className="w-3 h-3" />
                <span className="text-[10px]">5 min cache</span>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <p className="text-3xl font-bold" style={{ color: shedding.color }}>
                  {shedding.stage === 0 ? 'None' : `Stage ${shedding.stage}`}
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{shedding.label}</p>
              </div>
              <div className="ml-auto w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                style={{ background: `${shedding.color}20` }}>
                {shedding.stage === 0 ? '✅' : shedding.stage <= 2 ? '⚠️' : '🔴'}
              </div>
            </div>
          </div>

          {/* Weather */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: '#0EA5E920' }}>
                <Cloud className="w-4 h-4" style={{ color: '#0EA5E9' }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Weather</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{weather.city} · Open-Meteo</p>
              </div>
              <div className="ml-auto flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <RefreshCw className="w-3 h-3" />
                <span className="text-[10px]">10 min cache</span>
              </div>
            </div>

            <div className="flex items-end gap-3">
              <div>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {weather.temperature}°C
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  {weather.condition} · Feels {weather.feels_like}°C
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  💨 {weather.wind_kph} km/h · 💧 {weather.humidity}%
                </p>
              </div>
              <div className="ml-auto text-4xl">{weather.emoji}</div>
            </div>
          </div>
        </div>

        {/* FX Rates */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#22C55E20' }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#22C55E' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>FX Rates vs ZAR</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>open.er-api.com · 1 hour cache</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {fxPairs.map(({ code, flag, name }) => {
              const rate = fx.rates[code]
              return (
                <div key={code} className="rounded-xl p-3 text-center"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <p className="text-lg mb-1">{flag}</p>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{code}</p>
                  <p className="text-sm font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                    {rate != null ? rate.toFixed(4) : '—'}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    R1 = {rate != null ? rate.toFixed(4) : '—'} {code}
                  </p>
                </div>
              )
            })}
          </div>

          {fx.updated_at && (
            <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
              Rates last updated: {new Date(fx.updated_at).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
            </p>
          )}
        </div>

        {/* Phone Checker */}
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: '#F59E0B20' }}>
              <Phone className="w-4 h-4" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Phone Number Validator</p>
              <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Format & validate SA numbers — converts to E.164 for WhatsApp</p>
            </div>
          </div>
          <PhoneChecker />
        </div>

      </div>
    </div>
  )
}
