import { Fragment } from 'react'
import { Alert } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useMe } from '@/hooks/useMe'
import { shortDate, saToday } from '@/lib/format'
import type { StaffDocument } from '@/lib/types'
import { Screen, Card, ListRow, Divider, EmptyState, QueryView, C } from '@/components/ui'

export default function DocumentsScreen() {
  const { data: me } = useMe()
  const staffId = me?.staff?.id
  const q = useQuery({
    queryKey: ['documents', staffId],
    queryFn: () => api.get<StaffDocument[]>(`/api/staff/${staffId}/documents`),
    enabled: Boolean(staffId),
  })

  async function open(d: StaffDocument) {
    // https only (enforced when HR uploads it); never hand an arbitrary scheme to the OS.
    if (!d.file_url.startsWith('https://')) { Alert.alert('Can’t open this file', 'Ask HR to re-upload it.'); return }
    await WebBrowser.openBrowserAsync(d.file_url)
  }

  if (me && !staffId) {
    return <Screen title="My documents" back><EmptyState icon="link-outline" title="No staff record linked" body="Ask your employer for an app invite to see your documents." /></Screen>
  }

  const today = saToday()
  return (
    <Screen title="My documents" subtitle="Contracts, certificates and IDs HR keeps for you" back refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <QueryView
        query={q}
        isEmpty={(d) => d.length === 0}
        empty={<EmptyState icon="folder-open-outline" title="No documents yet" body="Your contract and other HR documents appear here when your employer uploads them." />}
      >
        {(docs) => (
          <Card className="py-0">
            {docs.map((d, i) => {
              const exp = d.expires_at?.slice(0, 10)
              const expired = exp && exp < today
              return (
                <Fragment key={d.id}>
                  {i > 0 && <Divider />}
                  <ListRow
                    icon="document-text-outline"
                    title={d.title}
                    subtitle={`${d.file_type ? `${d.file_type.toUpperCase()} · ` : ''}Added ${shortDate(d.created_at)}${exp ? ` · ${expired ? 'Expired' : 'Expires'} ${shortDate(exp)}` : ''}`}
                    tone={expired ? C.danger : undefined}
                    onPress={() => open(d)}
                  />
                </Fragment>
              )
            })}
          </Card>
        )}
      </QueryView>
    </Screen>
  )
}
