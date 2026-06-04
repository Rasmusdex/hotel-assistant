'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  Clock3,
  DoorOpen,
  RefreshCw,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

type RequestItem = {
  id: number
  room: string
  request: string
  status: string
  created_at: string
}

export default function AdminPage() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastCountRef = useRef(0)

  const fetchRequests = useCallback(async () => {
    setIsRefreshing(true)

    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      if (lastCountRef.current !== 0 && data.length > lastCountRef.current) {
        const audio = new Audio('/notification.mp3')
        audio.play()
      }

      lastCountRef.current = data.length
      setRequests(data)
    }

    setIsRefreshing(false)
  }, [])

  const completeRequest = async (id: number) => {
    await supabase.from('requests').update({ status: 'completed' }).eq('id', id)
    fetchRequests()
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchRequests()
    }, 0)

    const interval = setInterval(() => {
      fetchRequests()
    }, 2000)

    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [fetchRequests])

  const waitingRequests = useMemo(
    () => requests.filter((item) => item.status !== 'completed'),
    [requests]
  )

  const completedRequests = requests.length - waitingRequests.length

  return (
    <main className="min-h-screen bg-[#f6efe4] text-[#2d2923]">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.84),rgba(246,239,228,0.84)_42%,rgba(224,211,188,0.76))]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.045] bg-[linear-gradient(#2d2923_1px,transparent_1px),linear-gradient(90deg,#2d2923_1px,transparent_1px)] bg-[size:48px_48px]" />

      <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-[#d9c6a5] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-[#8a7144]">
              Hotel Operations
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-[#2d2923]">
              Resepsiyon Paneli
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[#74685b]">
              Oda talepleri, servis durumu ve tamamlanan işler tek ekranda.
            </p>
          </div>

          <button
            onClick={fetchRequests}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-[#cdb891] bg-[#fffaf2] px-4 text-sm font-semibold text-[#4b4137] shadow-sm transition hover:border-[#b9914c] hover:bg-white"
          >
            <RefreshCw
              size={17}
              className={isRefreshing ? 'animate-spin' : ''}
            />
            Yenile
          </button>
        </header>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <MetricCard
            label="Bekleyen"
            value={waitingRequests.length}
            icon={Bell}
            tone="gold"
          />
          <MetricCard
            label="Tamamlanan"
            value={completedRequests}
            icon={CheckCircle2}
            tone="sage"
          />
          <MetricCard
            label="Toplam Talep"
            value={requests.length}
            icon={DoorOpen}
            tone="linen"
          />
        </div>

        <section className="mt-6 overflow-hidden rounded-lg border border-[#d8c29b] bg-[#fffaf2]/88 shadow-[0_18px_60px_rgba(85,68,44,0.1)] backdrop-blur">
          <div className="flex flex-col gap-2 border-b border-[#e1d0b3] bg-[#fbf4ea] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#2d2923]">
                Güncel Talepler
              </h2>
              <p className="mt-1 text-sm text-[#74685b]">
                Yeni talepler otomatik olarak yenilenir.
              </p>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#d8bd7a] bg-white px-3 py-2 text-sm font-semibold text-[#8a6b35]">
              <Clock3 size={16} />
              Canlı
            </span>
          </div>

          {requests.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-[#efe4d0] text-[#8a6b35]">
                <Bell size={24} />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-[#2d2923]">
                Henüz talep yok
              </h3>
              <p className="mt-2 text-sm text-[#74685b]">
                Misafirlerden gelen istekler burada görünecek.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#eadfcc]">
              {requests.map((item) => {
                const isCompleted = item.status === 'completed'

                return (
                  <article
                    key={item.id}
                    className={`grid gap-4 px-5 py-5 transition md:grid-cols-[180px_1fr_180px] md:items-center ${
                      isCompleted
                        ? 'bg-[#f3eadc]/75 text-[#8b8277]'
                        : 'bg-[#fffaf2] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                          isCompleted
                            ? 'bg-[#e3dccf] text-[#7c756d]'
                            : 'bg-[#2d2923] text-[#ead7ad]'
                        }`}
                      >
                        <DoorOpen size={21} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#9a7b3e]">
                          Oda
                        </p>
                        <h3 className="text-2xl font-semibold text-[#2d2923]">
                          {item.room}
                        </h3>
                      </div>
                    </div>

                    <div>
                      <p className="text-base font-semibold text-[#2d2923]">
                        {item.request}
                      </p>
                      <p className="mt-2 text-sm text-[#74685b]">
                        {new Date(item.created_at).toLocaleString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: 'short',
                        })}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 md:items-end">
                      <span
                        className={`inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${
                          isCompleted
                            ? 'bg-[#e8eee0] text-[#556346]'
                            : 'bg-[#fff1cf] text-[#8a6122]'
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
                          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#2d2923] px-4 text-sm font-semibold text-white transition hover:bg-[#453c33]"
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
    </main>
  )
}

type MetricCardProps = {
  label: string
  value: number
  icon: typeof Bell
  tone: 'gold' | 'sage' | 'linen'
}

function MetricCard({ label, value, icon: Icon, tone }: MetricCardProps) {
  const tones = {
    gold: 'border-[#d8bd7a] bg-[#fff7e5] text-[#8a6122]',
    sage: 'border-[#c2ceb3] bg-[#f0f4ea] text-[#536345]',
    linen: 'border-[#d8c29b] bg-[#fffaf2] text-[#695d50]',
  }

  return (
    <div className="rounded-lg border border-[#d8c29b] bg-[#fffaf2]/86 p-5 shadow-[0_12px_34px_rgba(85,68,44,0.08)] backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#74685b]">{label}</p>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-[#2d2923]">
            {value}
          </p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg border ${tones[tone]}`}
        >
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}
