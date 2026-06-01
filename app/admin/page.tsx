'use client'

import { useEffect, useState } from 'react'
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
  const [lastCount, setLastCount] = useState(0)

  const fetchRequests = async () => {

    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {

      if (lastCount !== 0 && data.length > lastCount) {

        const audio = new Audio('/notification.mp3')
        audio.play()

      }

      setLastCount(data.length)
      setRequests(data)
    }
  }

  const completeRequest = async (id: number) => {

    await supabase
      .from('requests')
      .update({ status: 'completed' })
      .eq('id', id)

    fetchRequests()
  }

  useEffect(() => {

    fetchRequests()

    const interval = setInterval(() => {
      fetchRequests()
    }, 2000)

    return () => clearInterval(interval)

  }, [lastCount])

  return (

    <main className="min-h-screen bg-black text-white p-6">

      <h1 className="text-4xl font-bold mb-8">
        Resepsiyon Paneli
      </h1>

      <div className="flex flex-col gap-4">

        {requests.map((item) => (

          <div
            key={item.id}
            className={`rounded-3xl p-5 border ${
              item.status === 'completed'
                ? 'border-gray-700 opacity-50'
                : 'border-white'
            }`}
          >

            <div className="flex justify-between items-start mb-4">

              <div>

                <h2 className="text-2xl font-bold">
                  Oda {item.room}
                </h2>

                <p className="text-lg mt-2">
                  {item.request}
                </p>

              </div>

              <div className="text-right text-sm text-gray-400">

                <p>
                  {new Date(item.created_at).toLocaleTimeString('tr-TR')}
                </p>

                <p className="mt-2">
                  {item.status === 'completed'
                    ? 'Tamamlandı'
                    : 'Bekliyor'}
                </p>

              </div>

            </div>

            {item.status !== 'completed' && (

              <button
                onClick={() => completeRequest(item.id)}
                className="bg-white text-black px-5 py-3 rounded-2xl font-semibold"
              >
                Tamamlandı Olarak İşaretle
              </button>

            )}

          </div>

        ))}

      </div>

    </main>

  )
}