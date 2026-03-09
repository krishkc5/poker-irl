import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { findNextSeat } from '../lib/gameEngine'
import type { PlayerDoc, RoomDoc } from '../types/game'
import { formatChips } from '../utils/format'
import { Badge } from './Ui'

interface PlayersTableProps {
  room: RoomDoc
  players: PlayerDoc[]
  currentUid: string
}

type SeatPoint = {
  left: number
  top: number
}

const SEAT_LAYOUTS: Record<number, SeatPoint[]> = {
  1: [{ left: 50, top: 82 }],
  2: [
    { left: 50, top: 82 },
    { left: 50, top: 18 },
  ],
  3: [
    { left: 50, top: 82 },
    { left: 78, top: 24 },
    { left: 22, top: 24 },
  ],
  4: [
    { left: 50, top: 82 },
    { left: 84, top: 48 },
    { left: 50, top: 16 },
    { left: 16, top: 48 },
  ],
  5: [
    { left: 50, top: 84 },
    { left: 82, top: 58 },
    { left: 70, top: 18 },
    { left: 30, top: 18 },
    { left: 18, top: 58 },
  ],
  6: [
    { left: 50, top: 84 },
    { left: 84, top: 68 },
    { left: 82, top: 34 },
    { left: 66, top: 14 },
    { left: 34, top: 14 },
    { left: 18, top: 34 },
  ],
  7: [
    { left: 50, top: 85 },
    { left: 84, top: 72 },
    { left: 88, top: 44 },
    { left: 72, top: 16 },
    { left: 50, top: 10 },
    { left: 28, top: 16 },
    { left: 12, top: 44 },
  ],
  8: [
    { left: 50, top: 85 },
    { left: 82, top: 74 },
    { left: 89, top: 50 },
    { left: 76, top: 20 },
    { left: 50, top: 10 },
    { left: 24, top: 20 },
    { left: 11, top: 50 },
    { left: 18, top: 74 },
  ],
  9: [
    { left: 50, top: 86 },
    { left: 76, top: 79 },
    { left: 89, top: 58 },
    { left: 86, top: 30 },
    { left: 64, top: 12 },
    { left: 36, top: 12 },
    { left: 14, top: 30 },
    { left: 11, top: 58 },
    { left: 24, top: 79 },
  ],
}

const orderBySeat = (players: PlayerDoc[]): PlayerDoc[] =>
  [...players].sort((a, b) => {
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

const rotateForViewer = (players: PlayerDoc[], currentUid: string): PlayerDoc[] => {
  const viewerIndex = players.findIndex((player) => player.uid === currentUid)
  if (viewerIndex < 0) {
    return players
  }

  return [...players.slice(viewerIndex), ...players.slice(0, viewerIndex)]
}

const getSeatLayout = (count: number): SeatPoint[] => {
  if (SEAT_LAYOUTS[count]) {
    return SEAT_LAYOUTS[count]
  }

  return SEAT_LAYOUTS[9]
}

const scaleSeatPoint = (
  point: SeatPoint,
  spreadX: number,
  spreadY: number,
): SeatPoint => ({
  left: 50 + (point.left - 50) * spreadX,
  top: 50 + (point.top - 50) * spreadY,
})

const getBlindSeats = (
  room: RoomDoc,
  players: PlayerDoc[],
): { smallBlindSeat: number | null; bigBlindSeat: number | null } => {
  if (room.dealerSeat === null || room.status !== 'active') {
    return {
      smallBlindSeat: null,
      bigBlindSeat: null,
    }
  }

  const eligible = players.filter(
    (player) => player.seat !== null && player.stack + player.totalHandContribution > 0,
  )

  if (eligible.length < 2) {
    return {
      smallBlindSeat: null,
      bigBlindSeat: null,
    }
  }

  const smallBlindSeat =
    eligible.length === 2
      ? room.dealerSeat
      : findNextSeat(eligible, room.dealerSeat, () => true)

  const bigBlindSeat =
    smallBlindSeat === null ? null : findNextSeat(eligible, smallBlindSeat, () => true)

  return {
    smallBlindSeat,
    bigBlindSeat,
  }
}

const formatStreet = (street: RoomDoc['street']): string =>
  street.charAt(0).toUpperCase() + street.slice(1)

const TableCards = ({
  visible,
  showdown,
}: {
  visible: boolean
  showdown: boolean
}) => {
  if (!visible) {
    return null
  }

  return (
    <div className="pointer-events-none absolute -top-8 left-1/2 flex -translate-x-1/2 gap-1">
      {[0, 1].map((index) => (
        <div
          key={index}
          className={cn(
            'flex h-12 w-8 items-center justify-center rounded-[0.7rem] border shadow-[0_8px_18px_rgba(0,0,0,0.3)]',
            showdown
              ? 'border-[#d8cfbb] bg-[#fffaf0] text-slate-900'
              : 'border-emerald-100/15 bg-[linear-gradient(180deg,#294b40,#14241f)] text-emerald-100',
          )}
        >
          {showdown ? (
            <span className="poker-center-chip flex h-5 w-5 items-center justify-center rounded-full border border-amber-200/60 text-[8px] font-bold text-amber-950">
              $
            </span>
          ) : (
            <span className="block h-6 w-4 rounded-[0.45rem] border border-emerald-200/20 bg-[linear-gradient(180deg,rgba(64,136,103,0.92),rgba(18,51,40,0.96))]" />
          )}
        </div>
      ))}
    </div>
  )
}

const TableButtonRow = ({
  dealer,
  smallBlind,
  bigBlind,
}: {
  dealer: boolean
  smallBlind: boolean
  bigBlind: boolean
}) => {
  if (!dealer && !smallBlind && !bigBlind) {
    return null
  }

  return (
    <div className="pointer-events-none absolute -bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
      {dealer ? (
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-amber-100/60 bg-[linear-gradient(180deg,#fff2bd,#d8b35c)] text-[10px] font-bold text-amber-950 shadow-[0_8px_18px_rgba(0,0,0,0.25)]">
          D
        </span>
      ) : null}
      {smallBlind ? (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-white/12 bg-[linear-gradient(180deg,rgba(31,38,36,0.98),rgba(14,19,18,0.98))] px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-100 shadow-[0_8px_18px_rgba(0,0,0,0.25)]">
          SB
        </span>
      ) : null}
      {bigBlind ? (
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-rose-200/25 bg-[linear-gradient(180deg,#d66655,#b34839)] px-2 text-[9px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_18px_rgba(0,0,0,0.25)]">
          BB
        </span>
      ) : null}
    </div>
  )
}

const CompactSeatBody = ({
  player,
  isCurrentUser,
  isTurn,
  isHost,
}: {
  player: PlayerDoc
  isCurrentUser: boolean
  isTurn: boolean
  isHost: boolean
}) => {
  const flags = [
    isHost ? 'H' : null,
    isTurn ? 'T' : null,
    player.allIn ? 'AI' : null,
    player.folded ? 'F' : null,
  ].filter((flag): flag is string => flag !== null)

  return (
    <div className="compact-seat-body">
      <div className="compact-seat-top">
        <p className="compact-seat-name">
          {player.displayName}
          {isCurrentUser ? ' *' : ''}
        </p>
        <span className="compact-seat-stack">{formatChips(player.stack)}</span>
      </div>

      <div className="compact-seat-bottom">
        <span className="compact-seat-meta">S{player.seat}</span>

        {flags.length > 0 ? (
          <div className="compact-seat-flags">
            {flags.map((flag) => (
              <span
                key={`${player.uid}-${flag}`}
                className={cn(
                  'compact-seat-flag',
                  flag === 'AI' || flag === 'F'
                    ? 'compact-seat-flag-danger'
                    : 'compact-seat-flag-warning',
                )}
              >
                {flag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const PlayersTable = ({ room, players, currentUid }: PlayersTableProps) => {
  const seatedPlayers = orderBySeat(players).filter((player) => player.seat !== null)
  const displayPlayers = rotateForViewer(seatedPlayers, currentUid)
  const seatLayout = getSeatLayout(displayPlayers.length)
  const actingPlayer = players.find((player) => player.seat === room.currentTurnSeat) ?? null
  const { smallBlindSeat, bigBlindSeat } = getBlindSeats(room, seatedPlayers)
  const [isCompactLandscape, setIsCompactLandscape] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1180px) and (orientation: landscape)')
    const sync = () => setIsCompactLandscape(media.matches)
    sync()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', sync)
      return () => media.removeEventListener('change', sync)
    }

    media.addListener(sync)
    return () => media.removeListener(sync)
  }, [])

  const seatSpreadX = isCompactLandscape ? 0.62 : 1
  const seatSpreadY = isCompactLandscape ? 0.34 : 1

  return (
    <section className="table-arena-card poker-noise relative overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(10,16,14,0.94),rgba(6,10,9,0.98))] px-4 py-5 shadow-[0_30px_80px_rgba(0,0,0,0.38)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(70,171,111,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_22%)]" />

      <div className="table-arena-stage relative min-h-[620px] sm:min-h-[700px]">
        <div className="table-oval-shell poker-table-shell absolute left-1/2 top-1/2 h-[43%] w-[84%] -translate-x-1/2 -translate-y-1/2 rounded-[999px] p-4 sm:h-[46%] sm:w-[78%] sm:p-5">
          <div className="poker-table-felt poker-noise relative flex h-full w-full flex-col items-center justify-center rounded-[999px] border border-white/10 px-5 text-center">
            <div className="table-center-chip poker-center-chip mb-4 rounded-full border border-amber-100/60 px-5 py-2 text-center text-amber-950">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em]">Pot</p>
              <p className="text-2xl font-extrabold">{formatChips(room.pot)}</p>
            </div>

            <div className="table-center-badges mb-3 flex flex-wrap items-center justify-center gap-2">
              <Badge tone="success">{formatStreet(room.street)}</Badge>
              <Badge tone="neutral">Hand {room.handNumber}</Badge>
              <Badge tone="warning">To Call {formatChips(room.currentBet)}</Badge>
            </div>

            <div className="table-center-copy max-w-md space-y-1 px-6">
              <p className="table-center-title text-lg font-semibold text-[var(--table-accent-ice)]">
                {room.street === 'showdown'
                  ? 'Showdown in progress'
                  : actingPlayer
                    ? `${actingPlayer.displayName} to act`
                    : 'Waiting for next action'}
              </p>
              <p className="table-center-subtitle text-sm text-emerald-50/75">
                {room.lastAction ?? 'Use the table to track chips, blinds, and action.'}
              </p>
            </div>
          </div>
        </div>

        {displayPlayers.map((player, index) => {
          const rawSeatPoint = seatLayout[index] ?? seatLayout[seatLayout.length - 1]
          const seatPoint = scaleSeatPoint(rawSeatPoint, seatSpreadX, seatSpreadY)
          const isDealer = room.dealerSeat !== null && player.seat === room.dealerSeat
          const isSmallBlind = smallBlindSeat !== null && player.seat === smallBlindSeat
          const isBigBlind = bigBlindSeat !== null && player.seat === bigBlindSeat
          const isTurn = room.currentTurnSeat !== null && player.seat === room.currentTurnSeat
          const isCurrentUser = player.uid === currentUid
          const cardsVisible = player.inHand && !player.folded
          const revealCards = cardsVisible && room.street === 'showdown'
          const compactSeat = displayPlayers.length >= 7

          return (
            <article
              key={player.uid}
              className={cn(
                'table-seat-wrap absolute -translate-x-1/2 -translate-y-1/2',
                compactSeat ? 'w-[9rem] sm:w-[9.75rem]' : 'w-[10rem] sm:w-[11.5rem]',
              )}
              style={{
                left: `${seatPoint.left}%`,
                top: `${seatPoint.top}%`,
              }}
            >
              <div className="table-seat-cards">
                <TableCards visible={cardsVisible} showdown={revealCards} />
              </div>

              <div
                className={cn(
                  'table-seat-body poker-seat-card rounded-[1.45rem] border px-3 py-3 text-slate-100 transition',
                  isCurrentUser && 'border-emerald-300/45 ring-2 ring-emerald-300/20',
                  isTurn && 'border-amber-300/50 ring-2 ring-amber-300/20',
                  player.folded && 'border-white/8 opacity-60 saturate-50',
                  player.allIn && !player.folded && 'border-rose-300/30',
                )}
              >
                {isCompactLandscape ? (
                  <CompactSeatBody
                    player={player}
                    isCurrentUser={isCurrentUser}
                    isTurn={isTurn}
                    isHost={player.uid === room.hostUid}
                  />
                ) : (
                  <>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--table-accent-ice)]">
                          {player.displayName}
                          {isCurrentUser ? ' (you)' : ''}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Seat {player.seat}</p>
                      </div>
                      <span className="rounded-full border border-white/8 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                        {formatChips(player.stack)}
                      </span>
                    </div>

                    <div className="mb-2 flex flex-wrap gap-1">
                      {player.uid === room.hostUid ? <Badge tone="warning">Host</Badge> : null}
                      {player.folded ? <Badge tone="danger">Folded</Badge> : null}
                      {player.allIn ? <Badge tone="danger">All-In</Badge> : null}
                      {isTurn ? <Badge tone="warning">Turn</Badge> : null}
                    </div>

                    <div className="table-seat-stats grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                      <div className="rounded-xl border border-white/8 bg-black/20 px-2.5 py-2">
                        <p className="uppercase tracking-[0.16em] text-slate-500">Street</p>
                        <p className="mt-1 font-semibold text-slate-100">
                          {formatChips(player.currentStreetContribution)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/8 bg-black/20 px-2.5 py-2">
                        <p className="uppercase tracking-[0.16em] text-slate-500">Hand</p>
                        <p className="mt-1 font-semibold text-slate-100">
                          {formatChips(player.totalHandContribution)}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="table-seat-buttons">
                <TableButtonRow
                  dealer={isDealer}
                  smallBlind={isSmallBlind}
                  bigBlind={isBigBlind}
                />
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
