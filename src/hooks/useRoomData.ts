import { useEffect, useMemo, useState } from 'react'
import type { ActionDoc, HandDoc, PlayerDoc, RoomDoc } from '../types/game'
import {
  subscribeActions,
  subscribeHands,
  subscribePlayers,
  subscribeRoom,
} from '../lib/firestoreApi'
import { normalizeRoomCode } from '../lib/roomCode'

interface RoomDataState {
  room: RoomDoc | null
  players: PlayerDoc[]
  actions: ActionDoc[]
  hands: HandDoc[]
  loading: boolean
  error: string | null
}

export const useRoomData = (roomCode: string): RoomDataState => {
  const normalizedRoomCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode])
  const isInvalidRoomCode = normalizedRoomCode.length !== 6

  const [room, setRoom] = useState<RoomDoc | null>(null)
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [actions, setActions] = useState<ActionDoc[]>([])
  const [hands, setHands] = useState<HandDoc[]>([])
  const [loading, setLoading] = useState(!isInvalidRoomCode)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isInvalidRoomCode) {
      return undefined
    }

    let roomReady = false
    let playersReady = false

    const updateReadyState = () => {
      if (roomReady && playersReady) {
        setLoading(false)
      }
    }

    const unsubscribeRoom = subscribeRoom(
      normalizedRoomCode,
      (nextRoom) => {
        roomReady = true
        setRoom(nextRoom)
        updateReadyState()
      },
      (snapshotError) => {
        roomReady = true
        setError(snapshotError.message)
        updateReadyState()
      },
    )

    const unsubscribePlayers = subscribePlayers(
      normalizedRoomCode,
      (nextPlayers) => {
        playersReady = true
        setPlayers(nextPlayers)
        updateReadyState()
      },
      (snapshotError) => {
        playersReady = true
        setError(snapshotError.message)
        updateReadyState()
      },
    )

    const unsubscribeActions = subscribeActions(
      normalizedRoomCode,
      (nextActions) => {
        setActions(nextActions)
      },
      (snapshotError) => {
        setError(snapshotError.message)
      },
    )

    const unsubscribeHands = subscribeHands(
      normalizedRoomCode,
      (nextHands) => {
        setHands(nextHands)
      },
      (snapshotError) => {
        setError(snapshotError.message)
      },
    )

    return () => {
      unsubscribeRoom()
      unsubscribePlayers()
      unsubscribeActions()
      unsubscribeHands()
    }
  }, [isInvalidRoomCode, normalizedRoomCode])

  const finalError = isInvalidRoomCode ? 'Invalid room code.' : error
  const finalLoading = isInvalidRoomCode ? false : loading

  return useMemo(
    () => ({
      room,
      players,
      actions,
      hands,
      loading: finalLoading,
      error: finalError,
    }),
    [actions, finalError, finalLoading, hands, players, room],
  )
}
