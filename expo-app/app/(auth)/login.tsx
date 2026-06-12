import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, Alert,
} from 'react-native'
import { router } from 'expo-router'
import * as LocalAuthentication from 'expo-local-authentication'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const setSession = useAuthStore(s => s.setSession)

  async function signIn() {
    if (!email || !password) return
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { Alert.alert('Sign in failed', error.message); return }
    setSession(data.session)
    const role = data.session.user.user_metadata?.role ?? 'staff'
    router.replace(role === 'owner' || role === 'manager' ? '/(owner)' : '/(my-admin)')
  }

  async function tryBiometric() {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Sign in to AdminOS' })
    if (result.success) {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setSession(data.session)
        const role = data.session.user.user_metadata?.role ?? 'staff'
        router.replace(role === 'owner' || role === 'manager' ? '/(owner)' : '/(my-admin)')
      }
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-navy-900"
    >
      <View className="flex-1 justify-center px-6">
        {/* Logo */}
        <View className="items-center mb-12">
          <View className="w-16 h-16 rounded-2xl bg-brand items-center justify-center mb-4">
            <Text className="text-white text-2xl font-bold">AO</Text>
          </View>
          <Text className="text-white text-2xl font-bold">AdminOS</Text>
          <Text className="text-gray-400 text-sm mt-1">The OS that runs your business</Text>
        </View>

        {/* Form */}
        <View className="space-y-4">
          <View>
            <Text className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@business.co.za"
              placeholderTextColor="#6B7280"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white text-sm"
            />
          </View>
          <View>
            <Text className="text-gray-400 text-xs mb-1.5 uppercase tracking-wide">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              placeholderTextColor="#6B7280"
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white text-sm"
            />
          </View>

          <TouchableOpacity
            onPress={signIn}
            disabled={loading}
            className="bg-brand rounded-xl py-4 items-center mt-2"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text className="text-white font-semibold text-base">Sign In</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={tryBiometric} className="items-center py-3">
            <Text className="text-brand text-sm">Use Face ID / Fingerprint</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')} className="items-center mt-6">
          <Text className="text-gray-500 text-sm">
            New to AdminOS? <Text className="text-brand">Create account</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
