import { useMemo, useState } from 'react'
import type { PlayerDoc, RoomDoc } from '../types/game'
import { Button, Panel } from './Ui'

interface RoomHeaderProps {
  room: RoomDoc
  players: PlayerDoc[]
  currentUid: string
  onLeave: () => Promise<void>
}

export const RoomHeader = ({ room, players, currentUid, onLeave }: RoomHeaderProps) => {
  const [copied, setCopied] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  const hostName = useMemo(
    () => players.find((player) => player.uid === room.hostUid)?.displayName ?? 'Unknown',
    [players, room.hostUid],
  )

  const currentPlayer = players.find((player) => player.uid === currentUid)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const handleLeave = async () => {
    setIsLeaving(true)
    try {
      await onLeave()
    } finally {
      setIsLeaving(false)
    }
  }

  return (
    <Panel className="room-header-shell mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Room</p>
        <h1 className="text-2xl font-extrabold tracking-wide text-emerald-100">{room.code}</h1>
        <p className="text-sm text-emerald-100/80">
          Host: {hostName}
          {currentPlayer?.uid === room.hostUid ? ' (you)' : ''}
        </p>
      </div>

      <div className="room-header-actions flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy Code'}
        </Button>
        <Button
          variant="danger"
          disabled={isLeaving}
          onClick={() => {
            if (!window.confirm('Leave this room?')) {
              return
            }

            void handleLeave()
          }}
        >
          {isLeaving ? 'Leaving...' : 'Leave Room'}
        </Button>
      </div>
    </Panel>
  )
}
