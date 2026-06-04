'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  Bath,
  Bed,
  Check,
  ChevronRight,
  Clock,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Utensils,
  Wind,
  Wine,
  X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'

type GuestExperienceProps = {
  roomNumber: string
}

type RequestCard = {
  title: string
  description: string
  note: string
  icon: typeof Bath
  key: string
  action: () => void
}

export default function GuestExperience({ roomNumber }: GuestExperienceProps) {
  const [showWelcome, setShowWelcome] = useState(true)
  const [showMiniBar, setShowMiniBar] = useState(false)
  const [showReception, setShowReception] = useState(false)
  const [miniBarText, setMiniBarText] = useState('')
  const [receptionText, setReceptionText] = useState('')
  const [successPopup, setSuccessPopup] = useState(false)
  const [loadingRequest, setLoadingRequest] = useState<string | null>(null)
  const [lastRequestId, setLastRequestId] = useState<number | null>(null)

  const sendRequest = async (requestType: string) => {
    try {
      setLoadingRequest(requestType)

      const { data, error } = await supabase
        .from('requests')
        .insert([
          {
            room: roomNumber,
            request: requestType,
            status: 'waiting',
          },
        ])
        .select()
        .single()

      if (error) {
        console.log(error)
        return
      }

      setLastRequestId(data.id)
      setSuccessPopup(true)
      setTimeout(() => setSuccessPopup(false), 2600)
    } catch (err) {
      console.log(err)
    } finally {
      setLoadingRequest(null)
    }
  }

  const cancelRequest = async () => {
    if (!lastRequestId) return

    try {
      const { error } = await supabase
        .from('requests')
        .delete()
        .eq('id', lastRequestId)

      if (!error) {
        setLastRequestId(null)
      }
    } catch (err) {
      console.log(err)
    }
  }

  const sendMiniBarRequest = async () => {
    if (!miniBarText.trim()) return

    await sendRequest(`Mini Bar: ${miniBarText}`)
    setMiniBarText('')
    setShowMiniBar(false)
  }

  const sendReceptionMessage = async () => {
    if (!receptionText.trim()) return

    await sendRequest(`Resepsiyona Mesaj: ${receptionText}`)
    setReceptionText('')
    setShowReception(false)
  }

  const requestCards: RequestCard[] = [
    {
      title: 'Havlu',
      description: 'Ekstra havlu talebi',
      note: 'Housekeeping',
      icon: Bath,
      action: () => sendRequest('Havlu Talebi'),
      key: 'Havlu Talebi',
    },
    {
      title: 'Pike',
      description: 'Yeni pike gönderimi',
      note: 'Oda konforu',
      icon: Wind,
      action: () => sendRequest('Pike Talebi'),
      key: 'Pike Talebi',
    },
    {
      title: 'Nevresim',
      description: 'Tam takım yenileme',
      note: 'Housekeeping',
      icon: Bed,
      action: () => sendRequest('Nevresim Yenileme Talebi'),
      key: 'Nevresim Yenileme Talebi',
    },
    {
      title: 'Mini Bar',
      description: 'İçecek ve ürün siparişi',
      note: '22:00 servis',
      icon: Wine,
      action: () => setShowMiniBar(true),
      key: 'mini-bar',
    },
    {
      title: 'Resepsiyon',
      description: 'Doğrudan mesaj',
      note: '7/24 destek',
      icon: MessageCircle,
      action: () => setShowReception(true),
      key: 'reception',
    },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6efe4] text-[#2d2923]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(246,239,228,0.76)_40%,rgba(226,211,184,0.72))]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[linear-gradient(#2d2923_1px,transparent_1px),linear-gradient(90deg,#2d2923_1px,transparent_1px)] bg-[size:48px_48px]" />

      <AnimatePresence>
        {successPopup && (
          <motion.div
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed left-1/2 top-5 z-[70] w-[calc(100%-32px)] max-w-md -translate-x-1/2"
          >
            <div className="flex items-center gap-4 rounded-lg border border-[#d8bd7a]/70 bg-[#fffaf2]/95 p-4 shadow-[0_18px_60px_rgba(64,52,38,0.18)] backdrop-blur">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#b9914c] text-white">
                <Check size={24} />
              </div>
              <div>
                <p className="text-base font-semibold text-[#2d2923]">
                  Talep gönderildi
                </p>
                <p className="mt-0.5 text-sm text-[#766b5e]">
                  Otel ekibi isteğinizi aldı.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showWelcome && (
          <InfoDialog
            title="Hoş geldiniz"
            icon={Sparkles}
            onClose={() => setShowWelcome(false)}
            buttonText="Devam Et"
          >
            <p>
              Oda temizliğimiz 2 günde bir, isteğe bağlı olarak yapılmaktadır.
              Bilgi almak için resepsiyona mesaj gönderebilirsiniz.
            </p>
          </InfoDialog>
        )}
      </AnimatePresence>

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-[#d9c6a5] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-[#d7bd86] bg-[#fff9ef] shadow-sm">
              <Image
                src="/logo.png"
                alt="Hotel logo"
                width={44}
                height={44}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-[#8a7144]">
                Guest Services
              </p>
              <h1 className="text-xl font-semibold text-[#2d2923]">
                Oda {roomNumber}
              </h1>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-[#dccaa9] bg-[#fff8ec]/80 px-3 py-2 text-sm text-[#695d50] sm:flex">
            <Clock size={16} />
            7/24 Resepsiyon
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-stretch">
          <section className="flex min-h-[420px] flex-col justify-between rounded-lg border border-[#d8c29b] bg-[#332f2a] p-6 text-white shadow-[0_22px_70px_rgba(64,52,38,0.22)] sm:p-8">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-[#d8bd7a]/45 bg-white/8 px-3 py-2 text-sm text-[#ead7ad]">
                <ShieldCheck size={16} />
                Özel oda asistanı
              </div>
              <h2 className="max-w-md text-4xl font-semibold leading-tight text-[#fff8ed] sm:text-5xl">
                Konaklamanız için gerekenler tek dokunuşta.
              </h2>
              <p className="mt-5 max-w-md text-base leading-7 text-[#ded2c4]">
                Havlu, nevresim, mini bar ve resepsiyon taleplerinizi doğrudan ilgili ekibe iletin.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ['Oda', roomNumber],
                ['Durum', 'Hazır'],
                ['Servis', 'Aktif'],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/10 bg-white/[0.06] p-4"
                >
                  <p className="text-xs uppercase text-[#d6bd7d]">{label}</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid content-start gap-3 sm:grid-cols-2">
            {requestCards.map((card) => {
              const Icon = card.icon
              const isLoading = loadingRequest === card.key

              return (
                <motion.button
                  key={card.key}
                  onClick={card.action}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.99 }}
                  className="group min-h-[152px] rounded-lg border border-[#d8c29b] bg-[#fffaf2]/88 p-5 text-left shadow-[0_14px_42px_rgba(85,68,44,0.1)] backdrop-blur transition hover:border-[#bd9853] hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#ede0c7] text-[#8a6b35] transition group-hover:bg-[#b9914c] group-hover:text-white">
                      {isLoading ? (
                        <Loader2 size={24} className="animate-spin" />
                      ) : (
                        <Icon size={24} strokeWidth={1.8} />
                      )}
                    </div>
                    <ChevronRight
                      size={20}
                      className="mt-1 text-[#9a8b7a] transition group-hover:translate-x-1 group-hover:text-[#8a6b35]"
                    />
                  </div>
                  <p className="mt-5 text-xs font-semibold uppercase text-[#9a7b3e]">
                    {card.note}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#2d2923]">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#74685b]">
                    {card.description}
                  </p>
                </motion.button>
              )
            })}

            <div className="rounded-lg border border-[#d8c29b] bg-[#efe4d0]/70 p-5 sm:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#fffaf2] text-[#8a6b35]">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <p className="font-semibold text-[#2d2923]">
                      Mini bar ve sıcak servis
                    </p>
                    <p className="mt-1 text-sm text-[#74685b]">
                      Restoran servisi 22:00&apos;da kapanır.
                    </p>
                  </div>
                </div>
                {lastRequestId && (
                  <button
                    onClick={cancelRequest}
                    className="rounded-lg border border-[#b75445] bg-[#fff6f3] px-4 py-3 text-sm font-semibold text-[#9e3325] transition hover:bg-[#ffece7]"
                  >
                    Son Talebi İptal Et
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <AnimatePresence>
        {showMiniBar && (
          <RequestDialog
            title="Mini Bar Talebi"
            description="İstediğiniz ürünleri yazın."
            value={miniBarText}
            setValue={setMiniBarText}
            placeholder="Örn: 2 soda, 1 su, cips..."
            onClose={() => setShowMiniBar(false)}
            onSubmit={sendMiniBarRequest}
            buttonText="Talebi Gönder"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReception && (
          <RequestDialog
            title="Resepsiyona Mesaj"
            description="Mesajınız doğrudan resepsiyon paneline düşer."
            value={receptionText}
            setValue={setReceptionText}
            placeholder="Mesajınızı yazın..."
            onClose={() => setShowReception(false)}
            onSubmit={sendReceptionMessage}
            buttonText="Mesaj Gönder"
          />
        )}
      </AnimatePresence>
    </main>
  )
}

type InfoDialogProps = {
  title: string
  icon: typeof Sparkles
  children: ReactNode
  onClose: () => void
  buttonText: string
}

function InfoDialog({
  title,
  icon: Icon,
  children,
  onClose,
  buttonText,
}: InfoDialogProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#201c18]/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="w-full max-w-md rounded-lg border border-[#d8bd7a] bg-[#fffaf2] p-6 shadow-[0_24px_80px_rgba(32,28,24,0.28)]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#b9914c] text-white">
          <Icon size={24} />
        </div>
        <h2 className="mt-5 text-3xl font-semibold text-[#2d2923]">
          {title}
        </h2>
        <div className="mt-4 text-base leading-7 text-[#74685b]">
          {children}
        </div>
        <button
          onClick={onClose}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-[#2d2923] px-5 text-base font-semibold text-white transition hover:bg-[#453c33]"
        >
          {buttonText}
        </button>
      </motion.div>
    </motion.div>
  )
}

type RequestDialogProps = {
  title: string
  description: string
  value: string
  setValue: (value: string) => void
  placeholder: string
  onClose: () => void
  onSubmit: () => void
  buttonText: string
}

function RequestDialog({
  title,
  description,
  value,
  setValue,
  placeholder,
  onClose,
  onSubmit,
  buttonText,
}: RequestDialogProps) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#201c18]/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="w-full max-w-lg rounded-lg border border-[#d8bd7a] bg-[#fffaf2] p-6 shadow-[0_24px_80px_rgba(32,28,24,0.28)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[#2d2923]">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#74685b]">
              {description}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#dfceb4] bg-white text-[#5d5146] transition hover:bg-[#f2e7d7]"
          >
            <X size={19} />
          </button>
        </div>

        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="mt-5 h-36 w-full resize-none rounded-lg border border-[#d9c6a5] bg-white p-4 text-base text-[#2d2923] outline-none transition placeholder:text-[#a5998a] focus:border-[#b9914c] focus:ring-4 focus:ring-[#d8bd7a]/25"
        />

        <button
          onClick={onSubmit}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-lg bg-[#2d2923] px-5 text-base font-semibold text-white transition hover:bg-[#453c33]"
        >
          {buttonText}
        </button>
      </motion.div>
    </motion.div>
  )
}
