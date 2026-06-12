import { useState, useRef, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { apiFetch } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

type Message = { role: 'user' | 'assistant'; content: string }

const STARTERS = [
  'How do I improve my cash flow?',
  'What are my BBBEE obligations?',
  'Help me build 90-day goals',
  'How to handle a disciplinary hearing?',
]

export default function LangaScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<FlatList>(null)
  const { tenantId } = useAuthStore()

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true })
  }, [messages, loading])

  async function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    const userMsg: Message = { role: 'user', content: msg }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const data = await apiFetch<{ reply?: string; message?: string }>('/api/agents/langa', {
        method: 'POST',
        body: JSON.stringify({ message: msg, history: messages, tenantId }),
      })
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? data.message ?? '' }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const allItems: (Message | 'loading')[] = loading ? [...messages, 'loading'] : messages

  return (
    <SafeAreaView className="flex-1 bg-navy-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-white/10">
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center">
            <Text className="text-white text-lg">🧠</Text>
          </View>
          <View>
            <Text className="text-white font-semibold">Langa</Text>
            <Text className="text-gray-400 text-xs">AI Business Mentor</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-2 h-2 rounded-full bg-emerald-400" />
          <Text className="text-emerald-400 text-xs font-medium">Online</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        {messages.length === 0 && !loading ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-white text-xl font-bold mb-2">Sawubona! I'm Langa.</Text>
            <Text className="text-gray-400 text-sm text-center mb-8 leading-relaxed">
              Your AI business mentor. Ask me about cash flow, compliance, hiring, strategy, or anything keeping you up at night.
            </Text>
            <View className="w-full gap-2.5">
              {STARTERS.map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => send(s)}
                  className="bg-white/10 border border-white/20 rounded-xl px-4 py-3"
                >
                  <Text className="text-gray-300 text-sm">{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={allItems}
            keyExtractor={(_, i) => String(i)}
            contentContainerClassName="px-4 py-4 gap-4"
            renderItem={({ item }) => {
              if (item === 'loading') {
                return (
                  <View className="flex-row gap-2 items-end">
                    <View className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 items-center justify-center">
                      <Text className="text-white text-xs">🧠</Text>
                    </View>
                    <View className="bg-white/10 rounded-2xl rounded-bl-sm px-4 py-3">
                      <ActivityIndicator size="small" color="#6366F1" />
                    </View>
                  </View>
                )
              }
              const isUser = item.role === 'user'
              return (
                <View className={`flex-row gap-2 items-end ${isUser ? 'flex-row-reverse' : ''}`}>
                  <View className={`w-7 h-7 rounded-full items-center justify-center ${isUser ? 'bg-gray-600' : 'bg-indigo-600'}`}>
                    <Text className="text-white text-xs">{isUser ? '👤' : '🧠'}</Text>
                  </View>
                  <View
                    className={`max-w-[78%] px-4 py-3 rounded-2xl ${
                      isUser ? 'bg-brand rounded-tr-sm' : 'bg-white/10 rounded-bl-sm'
                    }`}
                  >
                    <Text className="text-white text-sm leading-relaxed">{item.content}</Text>
                  </View>
                </View>
              )
            }}
          />
        )}

        {/* Input */}
        <View className="px-4 py-3 border-t border-white/10 flex-row gap-2 items-end">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask Langa anything…"
            placeholderTextColor="#6B7280"
            multiline
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm"
            style={{ maxHeight: 120 }}
          />
          <TouchableOpacity
            onPress={() => send()}
            disabled={!input.trim() || loading}
            className="w-11 h-11 rounded-xl bg-brand items-center justify-center disabled:opacity-40"
          >
            <Text className="text-white text-lg">↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
