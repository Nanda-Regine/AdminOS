import { useState, useEffect, useRef } from 'react'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'

const LAST_ONLINE_KEY = 'network_last_online_at'

export interface NetworkStatus {
  isOnline: boolean
  isOffline: boolean
  connectionType: string | null
  lastOnlineAt: Date | null
}

export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkStatus>({
    isOnline: true,
    isOffline: false,
    connectionType: null,
    lastOnlineAt: null,
  })

  const lastOnlineRef = useRef<Date | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(LAST_ONLINE_KEY).then(raw => {
      if (raw) lastOnlineRef.current = new Date(raw)
    })

    const unsubscribe = NetInfo.addEventListener((netState: NetInfoState) => {
      const online = netState.isConnected === true && netState.isInternetReachable !== false

      if (online) {
        const now = new Date()
        lastOnlineRef.current = now
        AsyncStorage.setItem(LAST_ONLINE_KEY, now.toISOString())
      }

      setState({
        isOnline: online,
        isOffline: !online,
        connectionType: netState.type ?? null,
        lastOnlineAt: lastOnlineRef.current,
      })
    })

    return () => unsubscribe()
  }, [])

  return state
}
