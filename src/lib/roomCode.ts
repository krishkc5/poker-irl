const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export const ROOM_CODE_LENGTH = 6

export const normalizeRoomCode = (value: string): string =>
  value.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, ROOM_CODE_LENGTH)

export const isValidRoomCode = (value: string): boolean =>
  /^[A-Z]{6}$/.test(value)

export const generateRoomCode = (): string => {
  let code = ''

  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * ALPHABET.length)
    code += ALPHABET[randomIndex]
  }

  return code
}
