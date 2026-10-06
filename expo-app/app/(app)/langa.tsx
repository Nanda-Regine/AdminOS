import { useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { fetch as expoFetch } from 'expo/fetch'
import { Ionicons } from '@expo/vector-icons'
import { supabase } from '@/lib/supabase'
import { API_URL } from '@/lib/config'
import { useMe } from '@/hooks/useMe'
import { can } from '@/store/session'
import { Screen, EmptyState, C } from '@/components/ui'

interface Turn { role: 'user' | 'assistant'; content: string }

const STARTERS = ['Who owes me money right now?', 'How is my cash flow looking this month?', 'What compliance deadlines are coming up?']

/**
 * Langa — the AI business advisor, streamed token by token over SSE
 * (`data: {"text": …}` … `data: [DONE]`) from /api/agents/langa. expo/fetch
 * supports streaming response bodies; RN's built-in fetch does not.
 */
export default function LangaScreen() {
  const { data: me } = useMe()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const list = useRef<FlatList<Turn>>(null)

  async function ask(message: string) {
    if (!message.trim() || busy) return
    const history = turns.slice(-10)
    setTurns((t) => [...t, { role: 'user', content: message }, { role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    const append = (chunk: string) => setTurns((t) => {
      const copy = [...t]
      const last = copy[copy.length - 1]
      copy[copy.length - 1] = { ...last, content: last.content + chunk }
      return copy
    })
    try {
      const { data } = await supabase.auth.getSession()
      const res = await expoFetch(`${API_URL}/api/agents/langa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ message, history }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { text?: string; error?: string }
        append(body.text ?? body.error ?? (res.status === 403 ? 'Langa is available to owners and managers.' : 'Langa is unavailable right now. Please try again.'))
        return
      }
      const reader = res.body?.getReader()
      if (!reader) { append('Langa is unavailable right now.'); return }
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const ev of events) {
          const line = ev.split('\n').find((l) => l.startsWith('data: '))
          if (!line) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue
          try {
            const { text } = JSON.parse(payload) as { text?: string }
            if (text) append(text)
          } catch { /* keep-alive or partial frame */ }
        }
        list.current?.scrollToEnd({ animated: true })
      }
    } catch {
      append('\n\nThe connection dropped. Check your signal and ask again.')
    } finally {
      setBusy(false)
    }
  }

  if (me && !can(me, 'view_analytics')) {
    return <Screen title="Langa" back><EmptyState icon="lock-closed-outline" title="For owners and managers" body="Langa answers from the business’s financial data." /></Screen>
  }

  return (
    <Screen title="Langa" subtitle="Your AI business advisor" back scroll={false} padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90} className="flex-1">
        <FlatList
          ref={list}
          data={turns}
          keyExtractor={(_, i) => String(i)}
          contentContainerClassName="px-4 py-2 gap-3 flex-grow"
          ListEmptyComponent={
            <View className="gap-3 pt-6">
              <Text className="text-slate-400 text-center mb-2">Ask about your money, customers, staff or compliance.</Text>
              {STARTERS.map((s) => (
                <Pressable key={s} onPress={() => ask(s)} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 active:bg-white/10">
                  <Text className="text-slate-200">{s}</Text>
                </Pressable>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View className={`max-w-[90%] rounded-2xl px-4 py-3 ${item.role === 'user' ? 'self-end bg-brand' : 'self-start bg-white/5 border border-white/10'}`}>
              <Text className="text-white leading-6" selectable>{item.content || '…'}</Text>
            </View>
          )}
        />
        <Text className="text-slate-600 text-[10px] text-center px-4">Langa can make mistakes. Check important figures before acting on them.</Text>
        <View className="flex-row items-end gap-2 px-4 py-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Langa…"
            placeholderTextColor={C.dim}
            multiline
            maxLength={2000}
            accessibilityLabel="Message to Langa"
            className="flex-1 bg-white/10 rounded-2xl px-4 py-3 text-white max-h-32"
          />
          <Pressable
            onPress={() => ask(input.trim())}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Send"
            className={`w-11 h-11 rounded-full items-center justify-center ${input.trim() && !busy ? 'bg-brand' : 'bg-white/10'}`}
          >
            <Ionicons name={busy ? 'hourglass-outline' : 'arrow-up'} size={20} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}
