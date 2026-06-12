import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function SignupScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [business, setBusiness] = useState('')
  const [loading, setLoading] = useState(false)

  async function signUp() {
    if (!name || !email || !password || !business) {
      Alert.alert('Fill in all fields')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, business_name: business, role: 'owner' },
        emailRedirectTo: 'adminos://auth/callback',
      },
    })
    setLoading(false)
    if (error) { Alert.alert('Sign up failed', error.message); return }
    Alert.alert('Check your email', 'We sent you a confirmation link.', [
      { text: 'OK', onPress: () => router.replace('/(auth)/login') },
    ])
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-navy-900"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-brand text-sm">← Back to sign in</Text>
        </TouchableOpacity>

        <Text className="text-white text-2xl font-bold mb-2">Create your account</Text>
        <Text className="text-gray-400 text-sm mb-8">Start your free 14-day trial</Text>

        <View className="space-y-4">
          {[
            { label: 'Your Name', value: name, onChange: setName, placeholder: 'Nandawula Regine' },
            { label: 'Business Name', value: business, onChange: setBusiness, placeholder: 'Mirembe Muse (Pty) Ltd' },
            { label: 'Email', value: email, onChange: setEmail, placeholder: 'you@business.co.za', keyboard: 'email-address' as const },
            { label: 'Password', value: password, onChange: setPassword, placeholder: '8+ characters', secure: true },
          ].map(f => (
            <View key={f.label}>
              <Text className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.onChange}
                keyboardType={f.keyboard ?? 'default'}
                autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'words'}
                secureTextEntry={f.secure}
                placeholder={f.placeholder}
                placeholderTextColor="#6B7280"
                className="bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white text-sm"
              />
            </View>
          ))}

          <TouchableOpacity
            onPress={signUp}
            disabled={loading}
            className="bg-brand rounded-xl py-4 items-center mt-2"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-semibold text-base">Create Account</Text>
            }
          </TouchableOpacity>
        </View>

        <Text className="text-gray-600 text-xs text-center mt-6">
          By signing up you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}
