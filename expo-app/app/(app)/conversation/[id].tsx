import { useEffect, useRef, useState } from 'react'
import { Alert, FlatList, KeyboardAvoidingView, Platform, Text, TextInput, View, Pressable } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { api, errorMessage } from '@/lib/api'
import { time, shortDate } from '@/lib/format'
import type { Conversation, Message } from '@/lib/types'
import { Screen, Button, ErrorState, Loading, C } from '@/components/ui'

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const list = useRef<FlatList<Message>>(null)

  const q = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}/messages`),
    refetchInterval: 15_000,
  })

  useEffect(() => {
    if (q.data?.messages.length) setTimeout(() => list.current?.scrollToEnd({ animated: false }), 50)
  }, [q.data?.messages.length])

  const reply = useMutation({
    mutationFn: (message: string) => api.post('/api/conversations/reply', { conversationId: id, message }),
    onSuccess: () => {
      setText('')
      qc.invalidateQueries({ queryKey: ['conversation', id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
    // The text stays in the box so nothing typed is lost.
    onError: (e) => Alert.alert('Not sent', errorMessage(e)),
  })

  const setStatus = useMutation({
    mutationFn: (status: Conversation['status']) => api.post('/api/conversations/status', { conversationId: id, status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', id] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => Alert.alert('Not updated', errorMessage(e)),
  })

  const conv = q.data?.conversation
  const title = conv?.contact_name || conv?.contact_identifier || 'Conversation'

  return (
    <Screen title={title} subtitle={conv ? `${conv.channel ?? 'whatsapp'} · ${conv.status.replace('_', ' ')}` : undefined} back scroll={false} padded={false}>
      {q.data === undefined ? (q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Loading />) : (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} className="flex-1">
          {conv && conv.status !== 'closed' && (
            <View className="flex-row gap-2 px-4 pb-2">
              {conv.status === 'escalated' ? null : <View className="flex-1"><Button label="Escalate" variant="secondary" small onPress={() => setStatus.mutate('escalated')} /></View>}
              <View className="flex-1"><Button label="Mark resolved" variant="success" small onPress={() => setStatus.mutate('auto_resolved')} loading={setStatus.isPending} /></View>
              <View className="flex-1"><Button label="Close" variant="secondary" small onPress={() => setStatus.mutate('closed')} /></View>
            </View>
          )}
          <FlatList
            ref={list}
            data={q.data.messages}
            keyExtractor={(m) => m.id}
            contentContainerClassName="px-4 py-2 gap-2"
            ListEmptyComponent={<Text className="text-slate-500 text-center py-8">No messages yet.</Text>}
            renderItem={({ item: m, index }) => {
              const mine = m.role === 'assistant'
              const prev = q.data!.messages[index - 1]
              const newDay = !prev || shortDate(prev.created_at) !== shortDate(m.created_at)
              return (
                <View>
                  {newDay && <Text className="text-slate-500 text-xs text-center my-2">{shortDate(m.created_at)}</Text>}
                  <View className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${mine ? 'self-end bg-brand' : 'self-start bg-white/10'}`}>
                    <Text className="text-white leading-5" selectable>{m.content}</Text>
                    <Text className={`text-[10px] mt-1 ${mine ? 'text-indigo-200' : 'text-slate-400'}`}>{time(m.created_at)}</Text>
                  </View>
                </View>
              )
            }}
          />
          <View className="flex-row items-end gap-2 px-4 py-3 border-t border-white/10">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Reply on WhatsApp…"
              placeholderTextColor={C.dim}
              multiline
              maxLength={4000}
              accessibilityLabel="Reply"
              className="flex-1 bg-white/10 rounded-2xl px-4 py-3 text-white max-h-32"
            />
            <Pressable
              onPress={() => text.trim() && reply.mutate(text.trim())}
              disabled={!text.trim() || reply.isPending}
              accessibilityRole="button"
              accessibilityLabel="Send reply"
              className={`w-11 h-11 rounded-full items-center justify-center ${text.trim() ? 'bg-brand' : 'bg-white/10'}`}
            >
              <Ionicons name={reply.isPending ? 'hourglass-outline' : 'send'} size={18} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </Screen>
  )
}
