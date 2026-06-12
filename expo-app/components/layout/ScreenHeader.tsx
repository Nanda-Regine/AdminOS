import { View, Text, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'

interface ScreenHeaderProps {
  title: string
  subtitle?: string
  back?: boolean
  right?: React.ReactNode
}

export function ScreenHeader({ title, subtitle, back, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets()
  return (
    <View
      className="bg-navy-900 px-5 pb-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {back && (
            <TouchableOpacity onPress={() => router.back()} className="mr-1">
              <Text className="text-brand text-sm">←</Text>
            </TouchableOpacity>
          )}
          <View>
            <Text className="text-white text-lg font-bold">{title}</Text>
            {subtitle && <Text className="text-gray-400 text-xs mt-0.5">{subtitle}</Text>}
          </View>
        </View>
        {right}
      </View>
    </View>
  )
}
