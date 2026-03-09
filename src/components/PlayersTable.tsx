import type { PlayerDoc, RoomDoc } from '../types/game'
import { formatChips } from '../utils/format'
import { Badge } from './Ui'

interface PlayersTableProps {
  room: RoomDoc
  players: PlayerDoc[]
  currentUid: string
}

export const PlayersTable = ({ room, players, currentUid }: PlayersTableProps) => {
  const ordered = [...players].sort((a, b) => {
    if (a.seat !== null && b.seat !== null) {
      return a.seat - b.seat
    }

    if (a.seat !== null) {
      return -1
    }

    if (b.seat !== null) {
      return 1
    }

    return a.displayName.localeCompare(b.displayName)
  })

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ordered.map((player) => {
        const isDealer = room.dealerSeat !== null && player.seat === room.dealerSeat
        const isTurn = room.currentTurnSeat !== null && player.seat === room.currentTurnSeat

        return (
          <article
            key={player.uid}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-3"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">
                {player.displayName}
                {player.uid === currentUid ? ' (you)' : ''}
              </p>
              <div className="flex flex-wrap gap-1">
                {player.uid === room.hostUid && <Badge tone="warning">Host</Badge>}
                {isDealer && <Badge tone="success">Dealer</Badge>}
                {isTurn && <Badge tone="warning">Turn</Badge>}
                {player.folded && <Badge tone="danger">Folded</Badge>}
                {player.allIn && <Badge tone="warning">All-In</Badge>}
              </div>
            </div>

            <div className="text-xs text-slate-300">
              <p>Seat: {player.seat ?? '-'}</p>
              <p>Stack: {formatChips(player.stack)}</p>
              <p>Street: {formatChips(player.currentStreetContribution)}</p>
              <p>Hand: {formatChips(player.totalHandContribution)}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}
