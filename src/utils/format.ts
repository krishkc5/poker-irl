import type { Timestamp } from 'firebase/firestore'

export const formatChips = (value: number): string =>
  new Intl.NumberFormat('en-US').format(Math.max(0, Math.trunc(value)))

export const formatTimestamp = (timestamp: Timestamp | null): string => {
  if (!timestamp) {
    return 'Just now'
  }

  return timestamp.toDate().toLocaleString()
}

export const clampToPositiveInt = (value: number, fallback: number): number => {
  if (!Number.isFinite(value)) {
    return fallback
  }

  const nextValue = Math.trunc(value)
  return nextValue > 0 ? nextValue : fallback
}
