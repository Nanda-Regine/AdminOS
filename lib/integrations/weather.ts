export type WeatherData = {
  city:        string
  temperature: number
  feels_like:  number
  condition:   string
  emoji:       string
  wind_kph:    number
  humidity:    number
  fetched_at:  string
}

// WMO weather code → description + emoji
const WMO: Record<number, { desc: string; emoji: string }> = {
  0:  { desc: 'Clear sky',         emoji: '☀️' },
  1:  { desc: 'Mainly clear',      emoji: '🌤️' },
  2:  { desc: 'Partly cloudy',     emoji: '⛅' },
  3:  { desc: 'Overcast',          emoji: '☁️' },
  45: { desc: 'Foggy',             emoji: '🌫️' },
  48: { desc: 'Icy fog',           emoji: '🌫️' },
  51: { desc: 'Light drizzle',     emoji: '🌦️' },
  53: { desc: 'Drizzle',           emoji: '🌦️' },
  55: { desc: 'Heavy drizzle',     emoji: '🌧️' },
  61: { desc: 'Slight rain',       emoji: '🌧️' },
  63: { desc: 'Moderate rain',     emoji: '🌧️' },
  65: { desc: 'Heavy rain',        emoji: '⛈️' },
  71: { desc: 'Slight snow',       emoji: '🌨️' },
  73: { desc: 'Moderate snow',     emoji: '❄️' },
  75: { desc: 'Heavy snow',        emoji: '❄️' },
  80: { desc: 'Rain showers',      emoji: '🌦️' },
  81: { desc: 'Moderate showers',  emoji: '🌧️' },
  82: { desc: 'Violent showers',   emoji: '⛈️' },
  95: { desc: 'Thunderstorm',      emoji: '⛈️' },
  99: { desc: 'Severe storm',      emoji: '🌩️' },
}

// Pre-configured city coordinates (South African cities + common)
const CITIES: Record<string, { lat: number; lon: number; name: string }> = {
  johannesburg: { lat: -26.2041, lon: 28.0473,  name: 'Johannesburg' },
  cape_town:    { lat: -33.9249, lon: 18.4241,  name: 'Cape Town'    },
  durban:       { lat: -29.8587, lon: 31.0218,  name: 'Durban'       },
  pretoria:     { lat: -25.7479, lon: 28.2293,  name: 'Pretoria'     },
  bloemfontein: { lat: -29.0852, lon: 26.1596,  name: 'Bloemfontein' },
  east_london:  { lat: -33.0153, lon: 27.9116,  name: 'East London'  },
  port_elizabeth:{ lat: -33.9608, lon: 25.6022, name: 'Gqeberha'     },
}

export async function getWeather(city = 'johannesburg'): Promise<WeatherData> {
  const loc = CITIES[city.toLowerCase()] ?? CITIES.johannesburg
  const url  = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,apparent_temperature,weathercode,windspeed_10m,relativehumidity_2m&wind_speed_unit=kmh&timezone=Africa%2FJohannesburg`

  try {
    const res  = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(5000) })
    const json = await res.json()
    const cur  = json.current as {
      temperature_2m:        number
      apparent_temperature:  number
      weathercode:           number
      windspeed_10m:         number
      relativehumidity_2m:   number
    }
    const wmo = WMO[cur.weathercode] ?? { desc: 'Unknown', emoji: '🌡️' }
    return {
      city:        loc.name,
      temperature: Math.round(cur.temperature_2m),
      feels_like:  Math.round(cur.apparent_temperature),
      condition:   wmo.desc,
      emoji:       wmo.emoji,
      wind_kph:    Math.round(cur.windspeed_10m),
      humidity:    cur.relativehumidity_2m,
      fetched_at:  new Date().toISOString(),
    }
  } catch {
    return {
      city:        loc.name,
      temperature: 0,
      feels_like:  0,
      condition:   'Unavailable',
      emoji:       '🌡️',
      wind_kph:    0,
      humidity:    0,
      fetched_at:  new Date().toISOString(),
    }
  }
}
