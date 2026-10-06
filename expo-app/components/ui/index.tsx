import { type ReactNode } from 'react'
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View,
  type TextInputProps,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { errorMessage } from '@/lib/api'

export const C = {
  bg: '#0A0F2C',
  brand: '#6366F1',
  muted: '#94A3B8',
  dim: '#64748B',
  danger: '#F87171',
  success: '#34D399',
  warn: '#FBBF24',
}

// ── Screen shell ─────────────────────────────────────────────────────────────

export function Screen({
  title, subtitle, back, right, children, refreshing, onRefresh, scroll = true, padded = true,
}: {
  title?: string
  subtitle?: string
  back?: boolean
  right?: ReactNode
  children: ReactNode
  refreshing?: boolean
  onRefresh?: () => void
  scroll?: boolean
  padded?: boolean
}) {
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={padded ? 'px-4 pb-10 gap-3' : 'pb-10'}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.brand} colors={[C.brand]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View className={`flex-1 ${padded ? 'px-4' : ''}`}>{children}</View>
  )

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-navy-900">
      <OfflineBanner />
      {(title || back) && (
        <View className="flex-row items-center px-4 pt-2 pb-3 gap-3">
          {back && (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
            >
              <Ionicons name="chevron-back" size={20} color="#fff" />
            </Pressable>
          )}
          <View className="flex-1">
            {title ? <Text accessibilityRole="header" className="text-white text-2xl font-bold" numberOfLines={1}>{title}</Text> : null}
            {subtitle ? <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {body}
    </SafeAreaView>
  )
}

export function OfflineBanner() {
  const { isOffline } = useNetworkStatus()
  if (!isOffline) return null
  return (
    <View className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 flex-row items-center gap-2" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={16} color={C.warn} />
      <Text className="text-amber-300 text-xs flex-1">You’re offline — showing saved information. Clock-ins are saved and sent when you reconnect.</Text>
    </View>
  )
}

// ── Building blocks ──────────────────────────────────────────────────────────

export function Card({ children, onPress, className = '' }: { children: ReactNode; onPress?: () => void; className?: string }) {
  const cls = `bg-white/5 border border-white/10 rounded-2xl p-4 ${className}`
  if (!onPress) return <View className={cls}>{children}</View>
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={`${cls} active:bg-white/10`}>
      {children}
    </Pressable>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between mt-3 mb-1">
      <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider">{children}</Text>
      {right}
    </View>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
const BTN: Record<ButtonVariant, { box: string; text: string }> = {
  primary:   { box: 'bg-brand', text: 'text-white' },
  secondary: { box: 'bg-white/10 border border-white/15', text: 'text-white' },
  danger:    { box: 'bg-red-500/90', text: 'text-white' },
  success:   { box: 'bg-emerald-600', text: 'text-white' },
  ghost:     { box: '', text: 'text-brand-light' },
}

export function Button({
  label, onPress, variant = 'primary', loading, disabled, icon, small,
}: {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  small?: boolean
}) {
  const v = BTN[variant]
  const off = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      className={`${v.box} rounded-xl ${small ? 'px-3 py-2' : 'px-4 py-3.5'} flex-row items-center justify-center gap-2 ${off ? 'opacity-50' : 'active:opacity-80'}`}
    >
      {loading ? <ActivityIndicator color="#fff" size="small" /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color="#fff" /> : null}
      <Text className={`${v.text} font-semibold ${small ? 'text-sm' : 'text-base'}`}>{label}</Text>
    </Pressable>
  )
}

const BADGE = {
  gray: 'bg-white/10 text-slate-300',
  green: 'bg-emerald-500/15 text-emerald-300',
  red: 'bg-red-500/15 text-red-300',
  amber: 'bg-amber-500/15 text-amber-300',
  indigo: 'bg-indigo-500/20 text-indigo-200',
} as const

export function Badge({ label, tone = 'gray' }: { label: string; tone?: keyof typeof BADGE }) {
  const [bg, fg] = BADGE[tone].split(' ')
  return (
    <View className={`${bg} rounded-full px-2.5 py-0.5 self-start`}>
      <Text className={`${fg} text-xs font-medium`}>{label}</Text>
    </View>
  )
}

export function statusTone(status: string): keyof typeof BADGE {
  if (['approved', 'paid', 'done', 'completed', 'auto_resolved', 'closed'].includes(status)) return 'green'
  if (['declined', 'rejected', 'cancelled', 'overdue', 'escalated', 'in_collections'].includes(status)) return 'red'
  if (['pending', 'review', 'partial', 'in_progress'].includes(status)) return 'amber'
  return 'gray'
}

export function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row justify-between py-1.5">
      <Text className="text-slate-400 text-sm">{label}</Text>
      <Text className={`text-white text-sm ${strong ? 'font-bold' : ''}`}>{value}</Text>
    </View>
  )
}

export function Field({
  label, error, hint, ...input
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  return (
    <View className="gap-1.5">
      <Text className="text-slate-400 text-xs uppercase tracking-wide">{label}</Text>
      <TextInput
        placeholderTextColor={C.dim}
        accessibilityLabel={label}
        className={`bg-white/10 border rounded-xl px-4 py-3.5 text-white text-base ${error ? 'border-red-400' : 'border-white/15'}`}
        {...input}
      />
      {error ? <Text className="text-red-300 text-xs">{error}</Text> : hint ? <Text className="text-slate-500 text-xs">{hint}</Text> : null}
    </View>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View className="flex-row bg-white/5 rounded-xl p-1 gap-1" accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          onPress={() => onChange(o.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === o.value }}
          className={`flex-1 rounded-lg py-2 items-center ${value === o.value ? 'bg-brand' : ''}`}
        >
          <Text className={`text-sm font-medium ${value === o.value ? 'text-white' : 'text-slate-400'}`}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

// ── States ───────────────────────────────────────────────────────────────────

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <View className="py-16 items-center gap-3" accessibilityLiveRegion="polite">
      <ActivityIndicator color={C.brand} />
      <Text className="text-slate-500 text-sm">{label}</Text>
    </View>
  )
}

export function EmptyState({ icon = 'sparkles-outline', title, body, action }: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <View className="py-14 items-center px-6 gap-2">
      <View className="w-14 h-14 rounded-2xl bg-white/5 items-center justify-center mb-2">
        <Ionicons name={icon} size={26} color={C.muted} />
      </View>
      <Text className="text-white text-base font-semibold text-center">{title}</Text>
      {body ? <Text className="text-slate-400 text-sm text-center leading-5">{body}</Text> : null}
      {action ? <View className="mt-3 self-stretch">{action}</View> : null}
    </View>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View className="py-12 items-center px-6 gap-2" accessibilityLiveRegion="assertive">
      <Ionicons name="alert-circle-outline" size={28} color={C.danger} />
      <Text className="text-white text-base font-semibold text-center">Couldn’t load this</Text>
      <Text className="text-slate-400 text-sm text-center">{errorMessage(error)}</Text>
      {onRetry ? <View className="mt-3"><Button label="Try again" variant="secondary" small onPress={onRetry} /></View> : null}
    </View>
  )
}

/** Renders loading / error / empty / data for a react-query result. */
export function QueryView<T>({
  query, empty, isEmpty, children,
}: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown }
  empty?: ReactNode
  isEmpty?: (data: T) => boolean
  children: (data: T) => ReactNode
}) {
  if (query.data === undefined) {
    if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
    return <Loading />
  }
  if (isEmpty?.(query.data) && empty) return <>{empty}</>
  return <>{children(query.data)}</>
}

export function ListRow({ icon, title, subtitle, right, onPress, tone }: {
  icon?: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  right?: ReactNode
  onPress?: () => void
  tone?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="flex-row items-center gap-3 py-3.5 active:opacity-70"
    >
      {icon ? (
        <View className="w-9 h-9 rounded-xl bg-white/5 items-center justify-center">
          <Ionicons name={icon} size={18} color={tone ?? C.muted} />
        </View>
      ) : null}
      <View className="flex-1">
        <Text className="text-white text-base" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.dim} /> : null)}
    </Pressable>
  )
}

export function Divider() {
  return <View className="h-px bg-white/10" />
}
