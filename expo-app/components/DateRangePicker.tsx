import { useMemo, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { saPublicHolidays } from '@/lib/workingDays'
import { C } from '@/components/ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/**
 * Month calendar for picking a leave range: tap the first day, then the last.
 * Monday-first (SA convention); weekends and public holidays are dimmed
 * because they cost no leave. No native date-picker dependency.
 */
export function DateRangePicker({
  start, end, onChange, min, max,
}: {
  start: string | null
  end: string | null
  onChange: (start: string | null, end: string | null) => void
  min?: string
  max?: string
}) {
  const initial = start ?? min ?? new Date().toISOString().slice(0, 10)
  const [cursor, setCursor] = useState(() => ({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 }))

  const holidays = useMemo(() => saPublicHolidays(cursor.y), [cursor.y])
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay() // 0 = Sun
    const lead = (first + 6) % 7 // Monday-first offset
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate()
    const out: (string | null)[] = Array(lead).fill(null)
    for (let d = 1; d <= days; d++) out.push(iso(cursor.y, cursor.m, d))
    while (out.length % 7) out.push(null)
    return out
  }, [cursor])

  function tap(day: string) {
    if ((min && day < min) || (max && day > max)) return
    if (!start || (start && end) || day < start) onChange(day, null)
    else onChange(start, day)
  }

  const shift = (delta: number) => setCursor(({ y, m }) => {
    const n = m + delta
    return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 }
  })

  return (
    <View className="bg-white/5 border border-white/10 rounded-2xl p-3">
      <View className="flex-row items-center justify-between mb-2">
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Previous month" className="p-2">
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </Pressable>
        <Text className="text-white font-semibold">{MONTHS[cursor.m]} {cursor.y}</Text>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Next month" className="p-2">
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS.map((w, i) => <Text key={i} className="flex-1 text-center text-slate-500 text-xs mb-1">{w}</Text>)}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, row) => (
        <View key={row} className="flex-row">
          {cells.slice(row * 7, row * 7 + 7).map((day, i) => {
            if (!day) return <View key={i} className="flex-1 aspect-square" />
            const weekend = i >= 5
            const holiday = holidays.has(day)
            const disabled = (min != null && day < min) || (max != null && day > max)
            const isEdge = day === start || day === end
            const inRange = start && end && day > start && day < end
            return (
              <Pressable
                key={day}
                onPress={() => tap(day)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${day}${holiday ? ', public holiday' : weekend ? ', weekend' : ''}`}
                accessibilityState={{ selected: isEdge || !!inRange, disabled }}
                className="flex-1 aspect-square p-0.5"
              >
                <View
                  className="flex-1 rounded-lg items-center justify-center"
                  style={{ backgroundColor: isEdge ? C.brand : inRange ? 'rgba(99,102,241,0.25)' : 'transparent' }}
                >
                  <Text style={{
                    color: disabled ? '#334155' : isEdge ? '#fff' : weekend || holiday ? C.dim : '#E2E8F0',
                    fontWeight: isEdge ? '700' : '400',
                    textDecorationLine: holiday ? 'underline' : 'none',
                  }}>
                    {Number(day.slice(8))}
                  </Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      ))}
      <Text className="text-slate-500 text-xs mt-2">Grey days are weekends and underlined days are public holidays — they don’t use leave.</Text>
    </View>
  )
}
