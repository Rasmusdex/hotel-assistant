'use client'

import { useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

export default function QRPage() {

  const [roomNumber, setRoomNumber] = useState('101')

  const websiteUrl = `hotel-assistant-ysp1-mpbf0a0k1-palacaner1234-4050s-projects.vercel.app}`

  return (

    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">

      <h1 className="text-4xl font-bold mb-8">
        QR Oluşturucu
      </h1>

      <input
        type="text"
        value={roomNumber}
        onChange={(e) => setRoomNumber(e.target.value)}
        placeholder="Oda numarası"
        className="text-black p-4 rounded-2xl mb-8 w-full max-w-sm"
      />

      <div className="bg-white p-6 rounded-3xl">

        <QRCodeCanvas
          value={websiteUrl}
          size={260}
        />

      </div>

      <p className="mt-6 text-gray-400 text-center break-all max-w-sm">
        {websiteUrl}
      </p>

    </main>

  )
}