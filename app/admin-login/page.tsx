'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  User,
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        const body = await response.json()
        setError(body.message || 'Giriş yapılamadı.')
        return
      }

      const nextPath =
        new URLSearchParams(window.location.search).get('next') || '/admin'

      router.replace(nextPath)
      router.refresh()
    } catch {
      setError('Bağlantı kurulamadı. Lütfen tekrar deneyin.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#10100f] px-4 py-10 text-[#fff7ec]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(214,178,104,0.2),transparent_31%),radial-gradient(circle_at_78%_4%,rgba(255,255,255,0.12),transparent_28%),linear-gradient(145deg,#10100f_0%,#24211d_48%,#0f0e0d_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e1c37b]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] bg-[linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] bg-[size:56px_56px]" />

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.08] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:p-8"
      >
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#f2d08b]/70 to-transparent" />

        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e0c079]/45 bg-[#f0d28b]/15 text-[#f4d99b] shadow-[0_18px_44px_rgba(214,178,104,0.18)]">
          <ShieldCheck size={27} />
        </div>

        <div className="mt-7 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-[#d3b36f]">
            Hotel Operations
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
            Resepsiyon Girişi
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#cfc5b7]">
            Yetkili ekip üyeleri için güvenli yönetim paneli.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#ded2c4]">
              Kullanıcı adı
            </span>
            <span className="flex h-12 items-center gap-3 rounded-2xl border border-white/12 bg-black/20 px-4 text-[#f7efe3] shadow-inner shadow-black/20 transition focus-within:border-[#d7b56e]">
              <User size={18} className="text-[#d7b56e]" />
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8e8375]"
                placeholder="admin"
                required
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-[#ded2c4]">
              Şifre
            </span>
            <span className="flex h-12 items-center gap-3 rounded-2xl border border-white/12 bg-black/20 px-4 text-[#f7efe3] shadow-inner shadow-black/20 transition focus-within:border-[#d7b56e]">
              <LockKeyhole size={18} className="text-[#d7b56e]" />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#8e8375]"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#c9b790] transition hover:bg-white/10 hover:text-white"
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          {error && (
            <div className="rounded-2xl border border-[#c65c4a]/35 bg-[#8f2f24]/20 px-4 py-3 text-sm text-[#ffd6ce]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#ead18f] px-5 text-sm font-semibold text-[#201c16] shadow-[0_16px_44px_rgba(214,178,104,0.24)] transition hover:bg-[#f6dea0] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting && <Loader2 size={18} className="animate-spin" />}
            Panele Gir
          </button>
        </form>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-xs leading-5 text-[#b9ad9c]">
          Oturum güvenli çerezle saklanır ve süre sonunda otomatik kapanır.
        </div>
      </motion.section>
    </main>
  )
}
