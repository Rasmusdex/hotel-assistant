'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BellRing,
  CheckCircle2,
  Clock3,
  DoorOpen,
  LogOut,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Volume2,
  Wifi,
  WifiOff,
  Wine,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { belongsToCurrentHotel, hotelId } from '@/lib/hotel'

type RequestItem = {
  id: number
  room: string
  request: string
  status: string
  created_at: string
  hotel_id?: string | null
  completed_at?: string | null
}

type NotificationPermissionState = NotificationPermission | 'unsupported'
type RealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

const COMPLETED_RETENTION_HOURS = 72
const CLEANUP_INTERVAL_MS = 1000 * 60 * 5
const POLLING_INTERVAL_MS = 5000
const TOAST_DURATION_MS = 12000
const NEW_REQUEST_HIGHLIGHT_MS = 14000

let notificationAudio: HTMLAudioElement | null = null
let fallbackAudioContext: AudioContext | null = null

function logAdminDebugEvent(event: string, detail?: string) {
  const entry = {
    at: new Date().toISOString(),
    event,
    detail,
  }

  console.info('[Hotel Admin]', entry)

  if (typeof window === 'undefined') return

  try {
    const history = JSON.parse(
      localStorage.getItem('hotelAdminDebugLog') || '[]'
    ) as typeof entry[]

    localStorage.setItem(
      'hotelAdminDebugLog',
      JSON.stringify([entry, ...history].slice(0, 80))
    )
  } catch {
    localStorage.setItem('hotelAdminDebugLog', JSON.stringify([entry]))
  }
}

export default function AdminPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [latestRequest, setLatestRequest] = useState<RequestItem | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [audioLoadError, setAudioLoadError] = useState(false)
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => {
      if (typeof window === 'undefined') return 'default'
      return 'Notification' in window ? Notification.permission : 'unsupported'
    })
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>('connecting')
  const [lastRealtimeEventAt, setLastRealtimeEventAt] = useState<string | null>(
    null
  )
  const [toastRequest, setToastRequest] = useState<RequestItem | null>(null)
  const [recentRequestIds, setRecentRequestIds] = useState<Set<number>>(
    () => new Set()
  )
  const [sessionDebug, setSessionDebug] = useState('Oturum kontrol ediliyor')
  const knownRequestIdsRef = useRef<Set<number>>(new Set())
  const initialLoadRef = useRef(true)
  const lastCleanupRef = useRef(0)
  const completedAtSupportedRef = useRef(true)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getNotificationAudio = useCallback(() => {
    if (!notificationAudio) {
      notificationAudio = new Audio('/notification.mp3')
      notificationAudio.preload = 'auto'
      notificationAudio.volume = 1
    }

    return notificationAudio
  }, [])

  const armNotificationSound = useCallback(async () => {
    const audio = getNotificationAudio()

    try {
      audio.pause()
      audio.currentTime = 0
      audio.volume = 0.01
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
      localStorage.setItem('adminNotificationSoundReady', 'true')
      setAudioReady(true)
      setAudioBlocked(false)
      logAdminDebugEvent('notification_audio_armed')
      return true
    } catch {
      setAudioReady(false)
      setAudioBlocked(true)
      logAdminDebugEvent('notification_audio_blocked')
      return false
    }
  }, [getNotificationAudio])

  const playFallbackTone = useCallback(async () => {
    if (typeof window === 'undefined') return false

    const audioWindow = window as typeof window & {
      webkitAudioContext?: typeof AudioContext
    }
    const AudioContextConstructor =
      window.AudioContext || audioWindow.webkitAudioContext

    if (!AudioContextConstructor) return false

    try {
      if (!fallbackAudioContext) {
        fallbackAudioContext = new AudioContextConstructor()
      }

      if (fallbackAudioContext.state === 'suspended') {
        await fallbackAudioContext.resume()
      }

      const oscillator = fallbackAudioContext.createOscillator()
      const gain = fallbackAudioContext.createGain()

      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(880, fallbackAudioContext.currentTime)
      gain.gain.setValueAtTime(0.001, fallbackAudioContext.currentTime)
      gain.gain.exponentialRampToValueAtTime(
        0.28,
        fallbackAudioContext.currentTime + 0.02
      )
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        fallbackAudioContext.currentTime + 0.72
      )

      oscillator.connect(gain)
      gain.connect(fallbackAudioContext.destination)
      oscillator.start()
      oscillator.stop(fallbackAudioContext.currentTime + 0.75)

      logAdminDebugEvent('notification_fallback_tone_played')
      return true
    } catch {
      logAdminDebugEvent('notification_fallback_tone_failed')
      return false
    }
  }, [])

  const playNotificationSound = useCallback(async () => {
    const audio = getNotificationAudio()

    try {
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
      await audio.play()
      setAudioReady(true)
      setAudioBlocked(false)

      ;[900, 1800].forEach((delay) => {
        window.setTimeout(() => {
          const followUpAudio = new Audio('/notification.mp3')
          followUpAudio.volume = 0.85
          followUpAudio.play().catch(() => undefined)
        }, delay)
      })
    } catch {
      const fallbackPlayed = await playFallbackTone()
      setAudioReady(fallbackPlayed)
      setAudioBlocked(!fallbackPlayed)
      logAdminDebugEvent(
        fallbackPlayed
          ? 'notification_audio_used_fallback'
          : 'notification_audio_failed'
      )
    }
  }, [getNotificationAudio, playFallbackTone])

  const showBrowserNotification = useCallback((item: RequestItem) => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      Notification.permission !== 'granted'
    ) {
      return
    }

    const notification = new Notification('Yeni oda talebi', {
      body: `Oda ${item.room}: ${item.request}`,
      icon: '/logo.png',
      tag: `request-${item.id}`,
      requireInteraction: true,
    })

    notification.onclick = () => {
      window.focus()
      setUnreadCount(0)
      notification.close()
    }
  }, [])

  const handleIncomingRequests = useCallback(
    (items: RequestItem[]) => {
      if (items.length === 0) return

      setLatestRequest(items[0])
      setUnreadCount((current) => current + items.length)
      setToastRequest(items[0])
      setRecentRequestIds((current) => {
        const next = new Set(current)
        items.forEach((item) => next.add(item.id))
        return next
      })
      playNotificationSound()
      showBrowserNotification(items[0])

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      toastTimerRef.current = setTimeout(() => {
        setToastRequest(null)
      }, TOAST_DURATION_MS)

      const highlightedIds = items.map((item) => item.id)
      window.setTimeout(() => {
        setRecentRequestIds((current) => {
          const next = new Set(current)
          highlightedIds.forEach((id) => next.delete(id))
          return next
        })
      }, NEW_REQUEST_HIGHLIGHT_MS)

      logAdminDebugEvent(
        'incoming_request_notified',
        `ids=${items.map((item) => item.id).join(',')}`
      )
    },
    [playNotificationSound, showBrowserNotification]
  )

  const cleanupOldCompletedRequests = useCallback(async () => {
    if (Date.now() - lastCleanupRef.current < CLEANUP_INTERVAL_MS) return

    lastCleanupRef.current = Date.now()
    const cutoff = new Date(
      Date.now() - COMPLETED_RETENTION_HOURS * 60 * 60 * 1000
    ).toISOString()

    if (completedAtSupportedRef.current) {
      let cleanupQuery = supabase
        .from('requests')
        .delete()
        .eq('status', 'completed')

      if (hotelId) {
        cleanupQuery = cleanupQuery.eq('hotel_id', hotelId)
      }

      const { error } = await cleanupQuery
        .lt('completed_at', cutoff)

      if (!error) return
      completedAtSupportedRef.current = false
    }

    let fallbackCleanupQuery = supabase
      .from('requests')
      .delete()
      .eq('status', 'completed')

    if (hotelId) {
      fallbackCleanupQuery = fallbackCleanupQuery.eq('hotel_id', hotelId)
    }

    await fallbackCleanupQuery
      .lt('created_at', cutoff)
  }, [])

  const fetchRequests = useCallback(
    async (options: { notifyNew?: boolean } = { notifyNew: true }) => {
      setIsRefreshing(true)

      await cleanupOldCompletedRequests()

      let query = supabase.from('requests').select('*')

      if (hotelId) {
        query = query.eq('hotel_id', hotelId)
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      })

      if (!error && data) {
        const activeRequests = data.filter(shouldShowRequest)

        if (initialLoadRef.current) {
          knownRequestIdsRef.current = new Set(
            activeRequests.map((item) => item.id)
          )
          initialLoadRef.current = false
        } else {
          const incoming = activeRequests.filter((item) => {
            const isKnown = knownRequestIdsRef.current.has(item.id)
            return !isKnown && item.status !== 'completed'
          })

          activeRequests.forEach((item) => knownRequestIdsRef.current.add(item.id))

          if (options.notifyNew !== false) {
            handleIncomingRequests(incoming)
          }
        }

        setRequests(activeRequests)
      } else if (error) {
        logAdminDebugEvent('request_fetch_error', error.message)
      }

      setIsRefreshing(false)
    },
    [cleanupOldCompletedRequests, handleIncomingRequests]
  )

  const completeRequest = async (id: number) => {
    const completedAt = new Date().toISOString()

    if (completedAtSupportedRef.current) {
      let completeQuery = supabase
        .from('requests')
        .update({ status: 'completed', completed_at: completedAt })

      if (hotelId) {
        completeQuery = completeQuery.eq('hotel_id', hotelId)
      }

      const { error } = await completeQuery.eq('id', id)

      if (!error) {
        fetchRequests({ notifyNew: false })
        return
      }

      completedAtSupportedRef.current = false
    }

    let fallbackCompleteQuery = supabase
      .from('requests')
      .update({ status: 'completed' })

    if (hotelId) {
      fallbackCompleteQuery = fallbackCompleteQuery.eq('hotel_id', hotelId)
    }

    await fallbackCompleteQuery.eq('id', id)
    fetchRequests({ notifyNew: false })
  }

  const enableNotifications = async () => {
    await armNotificationSound()

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    logAdminDebugEvent('notification_permission', permission)
  }

  const logout = async () => {
    await fetch('/api/admin-auth/logout', { method: 'POST' })
    router.replace('/admin-login')
    router.refresh()
  }

  const checkAdminSession = useCallback(
    async (reason: string) => {
      try {
        const response = await fetch('/api/admin-auth/session', {
          cache: 'no-store',
        })
        const payload = await response.json()

        if (!response.ok || !payload.authenticated) {
          const detail = payload.reason || `http_${response.status}`
          setSessionDebug(`Oturum sorunu: ${detail}`)
          logAdminDebugEvent('admin_session_invalid', `${reason}:${detail}`)
          router.replace(`/admin-login?reason=${encodeURIComponent(detail)}`)
          router.refresh()
          return
        }

        setSessionDebug('Oturum aktif')
        logAdminDebugEvent('admin_session_valid', reason)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown'
        setSessionDebug('Oturum kontrolü geçici olarak yapılamadı')
        logAdminDebugEvent('admin_session_check_failed', message)
      }
    },
    [router]
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const audio = getNotificationAudio()
    const markAudioLoaded = () => {
      setAudioLoadError(false)
      logAdminDebugEvent('notification_audio_loaded')
    }
    const markAudioFailed = () => {
      setAudioLoadError(true)
      logAdminDebugEvent('notification_audio_load_failed')
    }

    audio.addEventListener('canplaythrough', markAudioLoaded)
    audio.addEventListener('error', markAudioFailed)
    audio.load()

    const unlockAudio = () => {
      if (!audioReady) {
        armNotificationSound()
      }
    }

    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })

    return () => {
      audio.removeEventListener('canplaythrough', markAudioLoaded)
      audio.removeEventListener('error', markAudioFailed)
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [armNotificationSound, audioReady, getNotificationAudio])

  useEffect(() => {
    let isMounted = true
    let reconnectAttempt = 0

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const removeCurrentChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }

    const scheduleReconnect = (reason: string) => {
      if (!isMounted) return

      clearReconnectTimer()
      removeCurrentChannel()
      reconnectAttempt += 1
      const delay = Math.min(30000, 1000 * 2 ** reconnectAttempt)

      setRealtimeStatus('reconnecting')
      logAdminDebugEvent(
        'supabase_realtime_reconnect_scheduled',
        `${reason}; attempt=${reconnectAttempt}; delay=${delay}`
      )

      reconnectTimerRef.current = setTimeout(() => {
        subscribeToRealtime()
      }, delay)
    }

    const markRealtimeEvent = (event: string) => {
      setLastRealtimeEventAt(new Date().toISOString())
      logAdminDebugEvent('supabase_realtime_event', event)
    }

    const subscribeToRealtime = () => {
      if (!isMounted) return

      setRealtimeStatus(reconnectAttempt === 0 ? 'connecting' : 'reconnecting')

      const channel = supabase
        .channel(`admin-request-monitor-${Date.now()}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'requests' },
          (payload) => {
            markRealtimeEvent('INSERT')
            const item = payload.new as RequestItem
            if (!belongsToCurrentHotel(item)) return

            if (!knownRequestIdsRef.current.has(item.id)) {
              knownRequestIdsRef.current.add(item.id)
              handleIncomingRequests([item])
            }
            fetchRequests({ notifyNew: false })
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'requests' },
          () => {
            markRealtimeEvent('UPDATE')
            fetchRequests({ notifyNew: false })
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'requests' },
          () => {
            markRealtimeEvent('DELETE')
            fetchRequests({ notifyNew: false })
          }
        )
        .subscribe((status) => {
          logAdminDebugEvent('supabase_realtime_status', status)

          if (!isMounted) return

          if (status === 'SUBSCRIBED') {
            reconnectAttempt = 0
            setRealtimeStatus('connected')
            setLastRealtimeEventAt(new Date().toISOString())
            fetchRequests({ notifyNew: true })
            return
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setRealtimeStatus('error')
            scheduleReconnect(status)
          }

          if (status === 'CLOSED') {
            setRealtimeStatus('disconnected')
            scheduleReconnect(status)
          }
        })

      channelRef.current = channel
    }

    const timeout = setTimeout(() => {
      fetchRequests()
    }, 0)

    const interval = setInterval(() => {
      fetchRequests()
    }, POLLING_INTERVAL_MS)

    subscribeToRealtime()

    const refetchOnReturn = () => {
      if (document.visibilityState === 'visible') {
        fetchRequests({ notifyNew: true })
        checkAdminSession('visibility_return')
      }
    }

    const handleOnline = () => {
      logAdminDebugEvent('browser_online')
      scheduleReconnect('browser_online')
      fetchRequests({ notifyNew: true })
    }

    const handleOffline = () => {
      setRealtimeStatus('disconnected')
      logAdminDebugEvent('browser_offline')
    }

    document.addEventListener('visibilitychange', refetchOnReturn)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      isMounted = false
      clearTimeout(timeout)
      clearInterval(interval)
      clearReconnectTimer()
      document.removeEventListener('visibilitychange', refetchOnReturn)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      removeCurrentChannel()
    }
  }, [checkAdminSession, fetchRequests, handleIncomingRequests])

  useEffect(() => {
    const timeout = setTimeout(() => {
      checkAdminSession('admin_mount')
    }, 0)
    const interval = setInterval(() => {
      checkAdminSession('heartbeat')
    }, 1000 * 60 * 5)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [checkAdminSession])

  useEffect(() => {
    const title = 'Resepsiyon Paneli'
    document.title =
      unreadCount > 0 ? `(${unreadCount}) Yeni Talep - ${title}` : title
  }, [unreadCount])

  const pendingRequests = useMemo(
    () => requests.filter((item) => item.status !== 'completed'),
    [requests]
  )

  const completedRequests = useMemo(
    () => requests.filter((item) => item.status === 'completed'),
    [requests]
  )

  const totalRequestsToday = useMemo(
    () => requests.filter((item) => isToday(item.created_at)).length,
    [requests]
  )

  const minibarRequests = useMemo(
    () => requests.filter((item) => isMiniBarRequest(item.request)).length,
    [requests]
  )

  const receptionMessages = useMemo(
    () => requests.filter((item) => isReceptionMessage(item.request)).length,
    [requests]
  )

  const serviceStats = useMemo(() => getServiceStats(requests), [requests])
  const mostRequestedService = serviceStats[0]
  const needsNotificationSetup =
    notificationPermission !== 'granted' || !audioReady || audioBlocked
  const realtimeStatusText = getRealtimeStatusText(realtimeStatus)

  return (
    <main className="min-h-screen bg-[#11100f] text-[#fff8ed]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(207,166,82,0.18),transparent_28%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(135deg,#11100f_0%,#24211d_46%,#151311_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[size:52px_52px]" />

      {toastRequest && (
        <div className="fixed right-4 top-4 z-50 w-[calc(100%-32px)] max-w-sm rounded-lg border border-[#f1d184]/55 bg-[#181613]/95 p-4 shadow-[0_22px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#f1d184] text-[#17130d]">
              <BellRing size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f8dda0]">
                Yeni talep geldi
              </p>
              <p className="mt-1 text-base font-semibold text-white">
                Oda {toastRequest.room}
              </p>
              <p className="mt-1 max-h-10 overflow-hidden text-sm text-[#ded2c4]">
                {toastRequest.request}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase text-[#a99c86]">
                {formatRequestDate(toastRequest.created_at)}
              </p>
            </div>
          </div>
        </div>
      )}

      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold uppercase text-[#d6b56e]">
              <ShieldCheck size={16} />
              Hotel Operations
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
              Resepsiyon Paneli
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#cfc4b6]">
              Oda talepleri, canlı bildirimler ve servis performansı tek ekranda.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <span
              className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold backdrop-blur ${
                realtimeStatus === 'connected'
                  ? 'border-[#a9bd8d]/35 bg-[#a9bd8d]/12 text-[#cde0b0]'
                  : 'border-[#f0c15f]/35 bg-[#f0c15f]/12 text-[#ffd98a]'
              }`}
              title={
                lastRealtimeEventAt
                  ? `Son canlı olay: ${formatRequestDate(lastRealtimeEventAt)}`
                  : 'Canlı bağlantı kuruluyor'
              }
            >
              {realtimeStatus === 'connected' ? (
                <Wifi size={17} />
              ) : (
                <WifiOff size={17} />
              )}
              {realtimeStatusText}
            </span>
            <button
              onClick={enableNotifications}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#d6b56e]/35 bg-white/[0.08] px-4 text-sm font-semibold text-[#f2d08b] shadow-sm backdrop-blur transition hover:border-[#e5c67d] hover:bg-white/[0.12]"
            >
              <Volume2 size={17} />
              {audioReady && notificationPermission === 'granted'
                ? 'Bildirimler Aktif'
                : 'Bildirimleri Aç'}
            </button>
            <button
              onClick={() => fetchRequests({ notifyNew: false })}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/12 bg-white/[0.08] px-4 text-sm font-semibold text-[#f7efe3] shadow-sm backdrop-blur transition hover:border-[#d6b56e]/60 hover:bg-white/[0.12]"
            >
              <RefreshCw
                size={17}
                className={isRefreshing ? 'animate-spin' : ''}
              />
              Yenile
            </button>
            <button
              onClick={logout}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#c65c4a]/35 bg-[#8f2f24]/18 px-4 text-sm font-semibold text-[#ffd6ce] transition hover:bg-[#8f2f24]/28"
            >
              <LogOut size={17} />
              Çıkış
            </button>
          </div>
        </header>

        {needsNotificationSetup && (
          <section className="mt-5 flex flex-col gap-4 rounded-lg border border-[#f0c15f]/35 bg-[#f0c15f]/10 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#f1d184] text-[#17130d]">
                <Volume2 size={21} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f8dda0]">
                  Resepsiyon bildirimlerini etkinleştirin
                </p>
                <p className="mt-1 text-sm leading-6 text-[#ded2c4]">
                  Yeni taleplerde ses, tarayıcı bildirimi ve ekran uyarısı için
                  bu cihazda bir kez izin verilmesi gerekir.
                </p>
                {(audioBlocked || audioLoadError) && (
                  <p className="mt-2 text-xs font-semibold text-[#ffc1b2]">
                    Ses tarayıcı tarafından engellendi veya dosya yüklenemedi;
                    butona bastığınızda sistem sesi tekrar hazırlar.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={enableNotifications}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f1d184] px-4 text-sm font-semibold text-[#201c16] transition hover:bg-[#ffe4a3]"
            >
              Bildirimleri Aç
            </button>
          </section>
        )}

        {unreadCount > 0 && latestRequest && (
          <section className="mt-5 flex flex-col gap-4 rounded-lg border border-[#d6b56e]/45 bg-[#f1d184]/12 p-4 shadow-[0_16px_60px_rgba(0,0,0,0.2)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e6c779] text-[#17130d]">
                <BellRing size={23} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#f8dda0]">
                  {unreadCount} yeni talep var
                </p>
                <p className="mt-1 text-sm text-[#ded2c4]">
                  Oda {latestRequest.room}: {latestRequest.request}
                </p>
              </div>
            </div>
            <button
              onClick={() => setUnreadCount(0)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f1d184] px-4 text-sm font-semibold text-[#201c16] transition hover:bg-[#ffe4a3]"
            >
              Görüldü
            </button>
          </section>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Bugünkü Talep"
            value={totalRequestsToday}
            icon={BarChart3}
            tone="gold"
          />
          <MetricCard
            label="Bekleyen"
            value={pendingRequests.length}
            icon={Bell}
            tone="amber"
          />
          <MetricCard
            label="Tamamlanan"
            value={completedRequests.length}
            icon={CheckCircle2}
            tone="sage"
          />
          <MetricCard
            label="Mini Bar"
            value={minibarRequests}
            icon={Wine}
            tone="rose"
          />
          <MetricCard
            label="Resepsiyon"
            value={receptionMessages}
            icon={MessageCircle}
            tone="steel"
          />
          <MetricCard
            label="En Çok Talep"
            value={mostRequestedService?.label || 'Yok'}
            icon={Sparkles}
            tone="linen"
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
          <section className="rounded-lg border border-white/12 bg-white/[0.07] p-5 shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Most Requested Services
                </h2>
                <p className="mt-1 text-sm text-[#bfb4a6]">
                  Servis yoğunluğu ve talep dağılımı.
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#d6b56e]/18 text-[#f2d08b]">
                <BarChart3 size={21} />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {serviceStats.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/16 p-4 text-sm text-[#bfb4a6]">
                  Henüz analiz edilecek talep yok.
                </div>
              ) : (
                serviceStats.slice(0, 5).map((service) => (
                  <div key={service.label}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-[#f8ead4]">
                        {service.label}
                      </span>
                      <span className="text-[#d8bf86]">{service.count}</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d6b56e] to-[#fff0b8]"
                        style={{
                          width: `${Math.max(
                            8,
                            (service.count / serviceStats[0].count) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 rounded-lg border border-[#d6b56e]/20 bg-[#d6b56e]/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className="mt-0.5 shrink-0 text-[#f2d08b]"
                />
                <p className="text-sm leading-6 text-[#d7cdbc]">
                  Tamamlanan talepler 72 saat sonra otomatik temizlenir;
                  bekleyen talepler korunur.
                </p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-white/12 bg-white/[0.07] shadow-[0_18px_70px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex flex-col gap-2 border-b border-white/10 bg-white/[0.05] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Güncel Talepler
                </h2>
                <p className="mt-1 text-sm text-[#bfb4a6]">
                  Canlı güncellenir; eski tamamlanan kayıtlar gizlenir.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#d6b56e]/35 bg-[#d6b56e]/12 px-3 py-2 text-sm font-semibold text-[#f2d08b]">
                <Clock3 size={16} />
                {realtimeStatusText}
              </span>
            </div>

            {requests.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white/10 text-[#f2d08b]">
                  <Bell size={24} />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">
                  Henüz talep yok
                </h3>
                <p className="mt-2 text-sm text-[#bfb4a6]">
                  Misafirlerden gelen istekler burada görünecek.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {requests.map((item) => {
                  const isCompleted = item.status === 'completed'
                  const isRecent = recentRequestIds.has(item.id)

                  return (
                    <article
                      key={item.id}
                      className={`grid gap-4 px-5 py-5 transition md:grid-cols-[160px_1fr_170px] md:items-center ${
                        isRecent
                          ? 'bg-[#f1d184]/16 shadow-[inset_4px_0_0_#f1d184,0_0_44px_rgba(241,209,132,0.16)]'
                          : isCompleted
                          ? 'bg-white/[0.035] text-[#968d80]'
                          : 'bg-white/[0.055] hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                            isCompleted
                              ? 'bg-white/8 text-[#a79c8e]'
                              : 'bg-[#e7c779] text-[#17130d]'
                          }`}
                        >
                          <DoorOpen size={21} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase text-[#d6b56e]">
                            Oda
                          </p>
                          <h3 className="text-2xl font-semibold text-white">
                            {item.room}
                          </h3>
                        </div>
                      </div>

                      <div>
                        <p className="text-base font-semibold text-[#fff8ed]">
                          {item.request}
                        </p>
                        <p className="mt-2 text-sm text-[#bfb4a6]">
                          {formatRequestDate(item.created_at)}
                        </p>
                      </div>

                      <div className="flex flex-col gap-3 md:items-end">
                        <span
                          className={`inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                            isCompleted
                              ? 'bg-[#dce7d0]/12 text-[#b8caa6]'
                              : 'bg-[#f1d184]/16 text-[#f8dda0]'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={16} />
                          ) : (
                            <Clock3 size={16} />
                          )}
                          {isCompleted ? 'Tamamlandı' : 'Bekliyor'}
                        </span>

                        {!isCompleted && (
                          <button
                            onClick={() => completeRequest(item.id)}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f1d184] px-4 text-sm font-semibold text-[#201c16] transition hover:bg-[#ffe4a3]"
                          >
                            Tamamlandı
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </section>
        <p className="mt-4 text-xs text-[#8f8578]">
          Session: {sessionDebug}. Bildirim ve oturum olayları tarayıcıda
          hotelAdminDebugLog altında tutulur.
        </p>
      </section>
    </main>
  )
}

type MetricCardProps = {
  label: string
  value: number | string
  icon: LucideIcon
  tone: 'gold' | 'amber' | 'sage' | 'rose' | 'steel' | 'linen'
}

function MetricCard({ label, value, icon: Icon, tone }: MetricCardProps) {
  const tones = {
    gold: 'border-[#d6b56e]/35 bg-[#d6b56e]/13 text-[#f3d58d]',
    amber: 'border-[#f0c15f]/32 bg-[#f0c15f]/12 text-[#ffd98a]',
    sage: 'border-[#a9bd8d]/32 bg-[#a9bd8d]/12 text-[#cde0b0]',
    rose: 'border-[#d28b78]/32 bg-[#d28b78]/12 text-[#ffc1b2]',
    steel: 'border-[#94a8bd]/32 bg-[#94a8bd]/12 text-[#c7d8ea]',
    linen: 'border-white/16 bg-white/[0.07] text-[#f8ead4]',
  }

  return (
    <div className="rounded-lg border border-white/12 bg-white/[0.07] p-5 shadow-[0_14px_54px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#bfb4a6]">{label}</p>
          <p className="mt-2 truncate text-3xl font-semibold tracking-tight text-white">
            {value}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border ${tones[tone]}`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

function shouldShowRequest(item: RequestItem) {
  if (item.status !== 'completed') return true

  const completedAt = item.completed_at || item.created_at
  const completedTime = new Date(completedAt).getTime()

  if (Number.isNaN(completedTime)) return true

  return Date.now() - completedTime < COMPLETED_RETENTION_HOURS * 60 * 60 * 1000
}

function isToday(value: string) {
  const date = new Date(value)
  const now = new Date()

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function formatRequestDate(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  })
}

function isMiniBarRequest(request: string) {
  return request.toLocaleLowerCase('tr-TR').includes('mini bar')
}

function isReceptionMessage(request: string) {
  return request.toLocaleLowerCase('tr-TR').includes('resepsiyon')
}

function getServiceLabel(request: string) {
  const normalized = request.toLocaleLowerCase('tr-TR')

  if (normalized.includes('havlu')) return 'Havlu'
  if (normalized.includes('pike')) return 'Pike'
  if (normalized.includes('nevresim')) return 'Nevresim'
  if (normalized.includes('mini bar')) return 'Mini Bar'
  if (normalized.includes('resepsiyon')) return 'Resepsiyon Mesajı'

  return request.split(':')[0].replace(' Talebi', '').trim()
}

function getServiceStats(requests: RequestItem[]) {
  const counts = requests.reduce<Record<string, number>>((acc, item) => {
    const label = getServiceLabel(item.request)
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})

  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function getRealtimeStatusText(status: RealtimeStatus) {
  const labels: Record<RealtimeStatus, string> = {
    connecting: 'Bağlanıyor',
    connected: 'Canlı bağlı',
    reconnecting: 'Yeniden bağlanıyor',
    disconnected: 'Bağlantı yok',
    error: 'Bağlantı sorunu',
  }

  return labels[status]
}
