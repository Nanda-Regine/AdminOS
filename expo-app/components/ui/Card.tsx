import { View, type ViewProps } from 'react-native'

export function Card({ className = '', ...props }: ViewProps & { className?: string }) {
  return (
    <View
      className={`bg-white rounded-2xl p-4 shadow-sm ${className}`}
      {...props}
    />
  )
}
