import { View, Text } from 'react-native'

type Color = 'indigo' | 'green' | 'red' | 'yellow' | 'gray' | 'purple'

const colors: Record<Color, string> = {
  indigo: 'bg-indigo-100',
  green:  'bg-emerald-100',
  red:    'bg-red-100',
  yellow: 'bg-yellow-100',
  gray:   'bg-gray-100',
  purple: 'bg-purple-100',
}
const textColors: Record<Color, string> = {
  indigo: 'text-indigo-700',
  green:  'text-emerald-700',
  red:    'text-red-700',
  yellow: 'text-yellow-700',
  gray:   'text-gray-600',
  purple: 'text-purple-700',
}

interface BadgeProps {
  label: string
  color?: Color
}

export function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <View className={`rounded-full px-2.5 py-1 ${colors[color]}`}>
      <Text className={`text-xs font-medium ${textColors[color]}`}>{label}</Text>
    </View>
  )
}
