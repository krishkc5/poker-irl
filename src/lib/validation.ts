import type { RoomSettingsInput } from '../types/game'

export const normalizeDisplayName = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').slice(0, 24)

export const validateDisplayName = (value: string): string | null => {
  const normalized = normalizeDisplayName(value)
  if (!normalized) {
    return 'Display name is required.'
  }

  if (normalized.length < 2) {
    return 'Display name must be at least 2 characters.'
  }

  return null
}

export const validateRoomSettings = (settings: RoomSettingsInput): string | null => {
  if (settings.startingStack <= 0) {
    return 'Starting stack must be greater than 0.'
  }

  if (settings.smallBlind <= 0 || settings.bigBlind <= 0) {
    return 'Blinds must be greater than 0.'
  }

  if (settings.smallBlind >= settings.bigBlind) {
    return 'Big blind must be greater than small blind.'
  }

  return null
}

export const parsePositiveInt = (value: string, fallback: number): number => {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback
  }

  return parsed
}
