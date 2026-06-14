import { FlatList, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { ScreenHeader } from '@/components/layout/ScreenHeader'
import { Badge } from '@/components/ui/Badge'

export default function TrainingScreen() {
  const { tenantId, user } = useAuthStore()

  // Lessons the user has started/completed (via academy_progress)
  const { data: progress = [], isLoading } = useQuery({
    queryKey: ['academy-progress', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_progress')
        .select(`
          id, completed_at, score, time_spent_seconds,
          academy_lessons ( id, title, estimated_minutes,
            academy_modules ( level, title )
          )
        `)
        .eq('user_id', user!.id)
        .order('id', { ascending: false })
      return data ?? []
    },
    enabled: !!user?.id,
  })

  // All available lessons
  const { data: lessons = [] } = useQuery({
    queryKey: ['lessons-all'],
    queryFn: async () => {
      const { data } = await supabase
        .from('academy_lessons')
        .select(`
          id, title, estimated_minutes,
          academy_modules ( level, title )
        `)
        .order('id')
        .limit(30)
      return data ?? []
    },
  })

  const startedIds = new Set(progress.map((p: any) => p.academy_lessons?.id))
  const notStarted = lessons.filter((l: any) => !startedIds.has(l.id))

  function levelLabel(p: any) {
    const level = p.academy_lessons?.academy_modules?.level ?? 'foundation'
    return level.charAt(0).toUpperCase() + level.slice(1)
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <ScreenHeader title="Training" subtitle="Business Academy" />

      {isLoading
        ? <ActivityIndicator className="mt-10" color="#6366F1" />
        : (
          <FlatList
            data={[
              ...(progress.length > 0 ? [{ _type: 'header', label: 'My Progress' }] : []),
              ...progress.map(p => ({ _type: 'progress', ...p })),
              ...(notStarted.length > 0 ? [{ _type: 'header', label: 'Available Lessons' }] : []),
              ...notStarted.map(l => ({ _type: 'lesson', ...l })),
            ] as any[]}
            keyExtractor={(i, idx) => i.id ?? `h-${idx}`}
            contentContainerClassName="py-3 px-4 gap-3"
            ListEmptyComponent={<Text className="text-gray-400 text-sm text-center mt-10">No lessons available yet</Text>}
            renderItem={({ item }) => {
              if (item._type === 'header') {
                return <Text className="text-xs text-gray-400 font-medium uppercase tracking-wide mt-2 mb-1">{item.label}</Text>
              }
              if (item._type === 'progress') {
                const lesson = item.academy_lessons
                const done = !!item.completed_at
                return (
                  <View className="bg-white rounded-2xl p-4">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="text-gray-900 font-semibold text-sm flex-1 mr-2">{lesson?.title}</Text>
                      <Badge label={done ? 'Done' : 'Started'} color={done ? 'green' : 'indigo'} />
                    </View>
                    <Text className="text-gray-400 text-xs">{levelLabel(item)} · {lesson?.estimated_minutes ?? '?'} min</Text>
                    {item.score != null && (
                      <Text className="text-emerald-600 text-xs mt-1 font-medium">Score: {item.score}%</Text>
                    )}
                  </View>
                )
              }
              // Unstarted lesson
              const level = item.academy_modules?.level ?? 'foundation'
              return (
                <TouchableOpacity className="bg-white rounded-2xl p-4 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-indigo-100 items-center justify-center">
                    <Text className="text-indigo-700 font-bold text-xs uppercase">{level.slice(0, 3)}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-gray-500 text-xs mt-0.5">
                      {item.academy_modules?.title ?? level} · {item.estimated_minutes ?? '?'} min
                    </Text>
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
