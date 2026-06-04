'use client'

import { use } from 'react'
import GuestExperience from '../../components/GuestExperience'

export default function RoomPage({
  params,
}: {
  params: Promise<{ roomNumber: string }>
}) {
  const { roomNumber } = use(params)

  return <GuestExperience roomNumber={roomNumber} />
}
