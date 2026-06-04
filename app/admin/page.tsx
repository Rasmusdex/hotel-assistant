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
  Wine,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type RequestItem = {
  id: number
  room: string
  request: string
  status: string
  created_at: string
  completed_at?: string | null
}

type NotificationPermissionState = NotificationPermission | 'unsupported'

const COMPLETED_RETENTION_HOURS = 72
const CLEANUP_INTERVAL_MS = 1000 * 60 * 5

export default function AdminPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [latestRequest, setLatestRequest] = useState<RequestItem | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>('default')
  const knownRequestIdsRef = useRef<Set<number>>(new Set())
  const initialLoadRef = useRef(true)
  const lastCleanupRef = useRef(0)
  const completedAtSupportedRef = useRef(true)

  const playNotificationSound = useCallback(async () => {
    const audio = new Audio('/notification.mp3')

    try {
      audio.currentTime = 0
      audio.volume = 1
      await audio.play()
      setAudioReady(true)

      window.setTimeout(() => {
        const secondAlert = new Audio('/notification.mp3')
        secondAlert.volume = 0.72
        secondAlert.play().catch(() => undefined)
      }, 850)
    } catch {
      setAudioReady(false)
    }
  }, [])

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
      playNotificationSound()
      showBrowserNotification(items[0])
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
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('status', 'completed')
        .lt('completed_at', cutoff)

      if (!error) return
      completedAtSupportedRef.current = false
    }

    await supabase
      .from('requests')
      .delete()
      .eq('status', 'completed')
      .lt('created_at', cutoff)
  }, [])

  const fetchRequests = useCallback(
    async (options: { notifyNew?: boolean } = { notifyNew: true }) => {
      setIsRefreshing(true)

      await cleanupOldCompletedRequests()

      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false })

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
      }

      setIsRefreshing(false)
    },
    [cleanupOldCompletedRequests, handleIncomingRequests]
  )

  const completeRequest = async (id: number) => {
    const completedAt = new Date().toISOString()

    if (completedAtSupportedRef.current) {
      const { error } = await supabase
        .from('requests')
        .update({ status: 'completed', completed_at: completedAt })
        .eq('id', id)

      if (!error) {
        fetchRequests({ notifyNew: false })
        return
      }

      completedAtSupportedRef.current = false
    }

    await supabase.from('requests').update({ status: 'completed' }).eq('id', id)
    fetchRequests({ notifyNew: false })
  }

  const enableNotifications = async () => {
    const audio = new Audio('/notification.mp3')

    try {
      audio.currentTime = 0
      audio.volume = 0.35
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      audio.volume = 1
      setAudioReady(true)
    } catch {
      setAudioReady(false)
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
  }

  const logout = async () => {
    await fetch('/api/admin-auth/logout', { method: 'POST' })
    router.replace('/admin-login')
    router.refresh()
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchRequests()
    }, 0)

    const interval = setInterval(() => {
      fetchRequests()
    }, 10000)

    const channel = supabase
      .channel('admin-request-monitor')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'requests' },
        (payload) => {
          const item = payload.new as RequestItem
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
        () => fetchRequests({ notifyNew: false })
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'requests' },
        () => fetchRequests({ notifyNew: false })
      )
      .subscribe()

    const refetchOnReturn = () => {
      if (document.visibilityState === 'visible') {
        fetchRequests({ notifyNew: true })
      }
    }

    document.addEventListener('visibilitychange', refetchOnReturn)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', refetchOnReturn)
      supabase.removeChannel(channel)
    }
  }, [fetchRequests, handleIncomingRequests])

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

  return (
    <main className="min-h-screen bg-[#11100f] text-[#fff8ed]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(207,166,82,0.18),transparent_28%),radial-gradient(circle_at_88%_0%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(135deg,#11100f_0%,#24211d_46%,#151311_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.055] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[size:52px_52px]" />

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
                Canlı
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

                  return (
                    <article
                      key={item.id}
                      className={`grid gap-4 px-5 py-5 transition md:grid-cols-[160px_1fr_170px] md:items-center ${
                        isCompleted
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
