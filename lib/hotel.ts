export const hotelId = process.env.NEXT_PUBLIC_HOTEL_ID?.trim() || ''

export function withHotelId<T extends Record<string, unknown>>(payload: T) {
  if (!hotelId) return payload

  return {
    ...payload,
    hotel_id: hotelId,
  }
}

export function belongsToCurrentHotel(item: { hotel_id?: string | null }) {
  return !hotelId || !item.hotel_id || item.hotel_id === hotelId
}
