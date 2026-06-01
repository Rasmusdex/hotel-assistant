'use client'

import { use, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomNumber: string }>
}) {

  const { roomNumber } = use(params)

  const [showPopup, setShowPopup] = useState(true)

  const [showMiniBar, setShowMiniBar] = useState(false)
  const [showReception, setShowReception] = useState(false)

  const [miniBarText, setMiniBarText] = useState('')
  const [receptionText, setReceptionText] = useState('')

  const [lastRequestId, setLastRequestId] = useState<number | null>(null)

  const sendRequest = async (requestType: string) => {

    const { data, error } = await supabase
      .from('requests')
      .insert([
        {
          room: roomNumber,
          request: requestType,
          status: 'waiting'
        }
      ])
      .select()
      .single()

    if (error) {
      console.log(error)
      alert('Talep gönderilirken hata oluştu')
    } else {
      alert('Talebiniz başarıyla gönderildi')
      setLastRequestId(data.id)
    }
  }

  const cancelRequest = async () => {

    if (!lastRequestId) return

    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', lastRequestId)

    if (error) {
      alert('Talep iptal edilemedi')
    } else {
      alert('Talep iptal edildi')
      setLastRequestId(null)
    }
  }

  const sendMiniBarRequest = async () => {

    if (!miniBarText) return

    await sendRequest(`Mini Bar: ${miniBarText}`)

    setMiniBarText('')
    setShowMiniBar(false)
  }

  const sendReceptionMessage = async () => {

    if (!receptionText) return

    await sendRequest(`Resepsiyona Mesaj: ${receptionText}`)

    setReceptionText('')
    setShowReception(false)
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">

      {showPopup && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-white text-black p-6 rounded-3xl max-w-sm text-center">

            <h2 className="text-2xl font-bold mb-4">
              Bilgilendirme
            </h2>

            <p className="mb-6">
              Oda temizliğimiz 2 günde bir yapılmaktadır.
              <br />
              (İsteğe bağlı temizlik hizmeti mevcuttur.)
              <br /><br />
              Anlayışınız için teşekkür ederiz.
            </p>

            <button
              onClick={() => setShowPopup(false)}
              className="bg-black text-white px-6 py-3 rounded-2xl"
            >
              Tamam
            </button>

          </div>

        </div>
      )}

      {showMiniBar && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-white text-black p-6 rounded-3xl max-w-sm w-full">

            <h2 className="text-2xl font-bold mb-4">
              Mini Bar Talebi
            </h2>

            <p className="text-sm text-gray-600 mb-4">
              Restoran servisimiz saat 22:00'da kapanmaktadır.
              <br />
              Gece 00:00'dan sonra sıcak servis hizmetimiz bulunmamaktadır.
            </p>

            <textarea
              value={miniBarText}
              onChange={(e) => setMiniBarText(e.target.value)}
              placeholder="İstediğiniz ürünleri yazın..."
              className="w-full border p-4 rounded-2xl mb-4 h-32"
            />

            <button
              onClick={sendMiniBarRequest}
              className="bg-black text-white w-full py-3 rounded-2xl"
            >
              Gönder
            </button>

          </div>

        </div>
      )}

      {showReception && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

          <div className="bg-white text-black p-6 rounded-3xl max-w-sm w-full">

            <h2 className="text-2xl font-bold mb-4">
              Resepsiyona Mesaj
            </h2>

            <textarea
              value={receptionText}
              onChange={(e) => setReceptionText(e.target.value)}
              placeholder="Mesajınızı yazın..."
              className="w-full border p-4 rounded-2xl mb-4 h-32"
            />

            <button
              onClick={sendReceptionMessage}
              className="bg-black text-white w-full py-3 rounded-2xl"
            >
              Gönder
            </button>

          </div>

        </div>
      )}

      <h1 className="text-4xl font-bold mb-10">
        Oda {roomNumber}
      </h1>

      <div className="flex flex-col gap-4 w-full max-w-sm">

        <button
          onClick={() => sendRequest('Havlu Talebi')}
          className="bg-white text-black rounded-2xl p-5 text-lg font-semibold"
        >
          Havlu İstiyorum
        </button>

        <button
          onClick={() => sendRequest('Pike Talebi')}
          className="bg-white text-black rounded-2xl p-5 text-lg font-semibold"
        >
          Pike İstiyorum
        </button>

        <button
          onClick={() => sendRequest('Nevresim Yenileme Talebi')}
          className="bg-white text-black rounded-2xl p-5 text-lg font-semibold"
        >
          Nevresim Yenileme
        </button>

        <button
          onClick={() => setShowMiniBar(true)}
          className="bg-white text-black rounded-2xl p-5 text-lg font-semibold"
        >
          Mini Bar Talebi
        </button>

        <button
          onClick={() => setShowReception(true)}
          className="bg-white text-black rounded-2xl p-5 text-lg font-semibold"
        >
          Resepsiyona Mesaj
        </button>

      </div>

      {lastRequestId && (
        <button
          onClick={cancelRequest}
          className="mt-6 border border-red-500 text-red-500 rounded-2xl p-4 w-full max-w-sm"
        >
          Son Talebi İptal Et
        </button>
      )}

    </main>
  )
}