export type FxRates = {
  base:       string
  rates:      Record<string, number>
  updated_at: string
  fetched_at: string
}

const DISPLAY_PAIRS = ['USD', 'EUR', 'GBP', 'CNY', 'KES', 'NGN', 'BTC']

export async function getFxRates(base = 'ZAR'): Promise<FxRates> {
  try {
    // open.er-api.com — free tier, no key, 1500 requests/month
    const res  = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })
    const json = await res.json() as {
      result:        string
      base_code:     string
      rates:         Record<string, number>
      time_last_update_utc: string
    }
    if (json.result !== 'success') throw new Error('API error')

    const filtered: Record<string, number> = {}
    for (const pair of DISPLAY_PAIRS) {
      if (json.rates[pair] !== undefined) filtered[pair] = json.rates[pair]
    }

    return {
      base:       base,
      rates:      filtered,
      updated_at: json.time_last_update_utc,
      fetched_at: new Date().toISOString(),
    }
  } catch {
    return {
      base:       base,
      rates:      {},
      updated_at: '',
      fetched_at: new Date().toISOString(),
    }
  }
}
