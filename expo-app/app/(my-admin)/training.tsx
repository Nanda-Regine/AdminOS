import { FlatList, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'

const LEVEL_COLORS = ['indigo', 'green', 'purple', 'yellow'] as const

export default function TrainingScreen() {
  const { tenantId, user } = useAuthStore()

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['enrollments', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_enrollments')
        .select('id, status, progress, started_at, completed_at, academy_lessons(id, title, level, duration_minutes, category)')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: false })
      return data ?? []
    },
    enabled: !!user?.id,
  })

  const { data: available = [] } = useQuery({
    queryKey: ['lessons-available', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_lessons')
        .select('id, title, level, duration_minutes, category, description')
        .eq('published', true)
        .order('level', { ascending: true })
        .limit(20)
      return data ?? []
    },
    enabled: !!tenantId,
  })

  const enrolledIds = new Set(enrollments.map((e: any) => e.academy_lessons?.id))
  const unenrolled = available.filter(l => !enrolledIds.has(l.id))

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      <ScreenHeader title="Training" subtitle="Business Academy" />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={[
              ...(enrollments.length > 0 ? [{ type: 'header', label: 'My Courses' }] : []),
              ...enrollments.map(e => ({ type: 'enrolled', ...e })),
              ...(unenrolled.length > 0 ? [{ type: 'header', label: 'Available Lessons' }] : []),
              ...unenrolled.map(l => ({ type: 'lesson', ...l })),
            ] as any[]}
            keyExtractor={(i, idx) => i.id ?? `h-${idx}`}
            contentContainerClassName="py-3 px-4 gap-3"
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-2 mb-1">{item.label}</Text>
              }
              if (item.type === 'enrolled') {
                const lesson = item.academy_lessons
                const progress = item.progress ?? 0
                return (
                  <View className="bg-white rounded-2xl p-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-gray-900 font-semibold text-sm flex-1 mr-2">{lesson?.title}</Text>
                      <Badge label={item.status} color={item.status === 'completed' ? 'green' : 'indigo'} />
                    </View>
                    <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <View className="h-full bg-brand rounded-full" style={{ width: `${progress}%` }} />
                    </View>
                    <Text className="text-gray-400 text-xs mt-1.5">{progress}% complete</Text>
                  </View>
                )
              }
              return (
                <TouchableOpacity className="bg-white rounded-2xl p-4 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-indigo-100 items-center justify-center">
                    <Text className="text-indigo-700 font-bold text-sm">L{item.level}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">{item.duration_minutes} min · {item.category}</Text>
                  </View>
                  <Text className="text-brand text-sm">→</Text>
                </TouchableOpacity>
              )
            }}
          />
        )
      }
    </SafeAreaView>
  )
}
