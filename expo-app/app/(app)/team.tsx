import { useMemo, useState } from 'react'
import { Fragment } from 'react'
import { Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { DirectoryEntry } from '@/lib/types'
import { Screen, Card, Field, Divider, EmptyState, QueryView } from '@/components/ui'

export default function TeamScreen() {
  const [search, setSearch] = useState('')
  const q = useQuery({ queryKey: ['team'], queryFn: () => api.get<DirectoryEntry[]>('/api/staff/directory'), staleTime: 60 * 60_000 })

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    const list = q.data ?? []
    return s ? list.filter((p) => [p.full_name, p.job_title, p.department].some((v) => v?.toLowerCase().includes(s))) : list
  }, [q.data, search])

  return (
    <Screen title="Team" subtitle={q.data ? `${q.data.length} people` : undefined} back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <Field label="Search" value={search} onChangeText={setSearch} placeholder="Name, role or department" autoCorrect={false} />
      <QueryView query={q} isEmpty={(d) => d.length === 0} empty={<EmptyState icon="people-outline" title="No team members yet" />}>
        {() => filtered.length === 0 ? <EmptyState icon="search-outline" title="No one matches that search" /> : (
          <Card className="py-1">
            {filtered.map((p, i) => (
              <Fragment key={p.id}>
                {i > 0 && <Divider />}
                <View className="flex-row items-center gap-3 py-3">
                  <View className="w-10 h-10 rounded-full bg-brand/30 items-center justify-center">
                    <Text className="text-white font-bold">{p.full_name.trim().charAt(0).toUpperCase()}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white">{p.full_name}</Text>
                    <Text className="text-slate-400 text-xs">{[p.job_title, p.department].filter(Boolean).join(' · ') || 'Team member'}</Text>
                  </View>
                </View>
              </Fragment>
            ))}
          </Card>
        )}
      </QueryView>
    </Screen>
  )
}
