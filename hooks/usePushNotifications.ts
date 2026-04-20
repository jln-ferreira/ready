'use client'

import { useState, useEffect } from 'react'

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

interface PushState {
  isSupported:  boolean
  permission:   PermissionState
  isSubscribed: boolean
  loading:      boolean
  subscribe:    () => Promise<void>
  unsubscribe:  () => Promise<void>
}

export function usePushNotifications(householdId?: string): PushState {
  const [permission,   setPermission]   = useState<PermissionState>('default')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading,      setLoading]      = useState(true)

  const isSupported =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager'   in window

  useEffect(() => {
    if (!isSupported) { setLoading(false); return }

    const init = async () => {
      setPermission(Notification.permission as PermissionState)

      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
        const existing = await reg.pushManager.getSubscription()
        setIsSubscribed(!!existing)
      } catch {
        // SW registration failed (e.g., localhost HTTP without HTTPS)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [isSupported])

  async function subscribe() {
    if (!isSupported) return
    setLoading(true)

    try {
      const permission = await Notification.requestPermission()
      setPermission(permission as PermissionState)
      if (permission !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as ArrayBuffer,
      })

      await fetch('/api/push/subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subscription: sub.toJSON(), householdId }),
      })

      setIsSubscribed(true)
    } catch (err) {
      console.error('[push] subscribe failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function unsubscribe() {
    if (!isSupported) return
    setLoading(true)

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (!sub) return

      await sub.unsubscribe()
      await fetch('/api/push/subscribe', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ endpoint: sub.endpoint }),
      })

      setIsSubscribed(false)
    } catch (err) {
      console.error('[push] unsubscribe failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe }
}

// Convert a base64 VAPID public key to Uint8Array for pushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
