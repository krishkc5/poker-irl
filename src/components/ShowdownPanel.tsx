import { useEffect, useMemo, useState } from 'react'
import { calculateSidePots } from '../lib/gameEngine'
import type { PlayerDoc, RoomDoc, SidePotWinnerSelection } from '../types/game'
import { formatChips } from '../utils/format'
import { Button, ErrorBanner, Panel } from './Ui'

interface ShowdownPanelProps {
  room: RoomDoc
  players: PlayerDoc[]
  isHost: boolean
  busy: boolean
  error: string | null
  onSettle: (selections: SidePotWinnerSelection[]) => Promise<void>
}

export const ShowdownPanel = ({
  room,
  players,
  isHost,
  busy,
  error,
  onSettle,
}: ShowdownPanelProps) => {
  const sidePots = useMemo(() => calculateSidePots(players), [players])
  const playersByUid = useMemo(() => new Map(players.map((player) => [player.uid, player])), [players])
  const [selectedByPot, setSelectedByPot] = useState<Record<number, string[]>>({})
  const contestedPots = sidePots.filter((sidePot) => sidePot.eligibleUids.length > 1)

  useEffect(() => {
    setSelectedByPot({})
  }, [room.handNumber, room.pot])

  const toggle = (potIndex: number, uid: string) => {
    setSelectedByPot((current) => {
      const existing = current[potIndex] ?? []
      const next = existing.includes(uid)
        ? existing.filter((entry) => entry !== uid)
        : [...existing, uid]
      return {
        ...current,
        [potIndex]: next,
      }
    })
  }

  const canSettle =
    sidePots.length > 0 &&
    room.pot > 0 &&
    contestedPots.every((sidePot) => {
      const winners = selectedByPot[sidePot.index] ?? []
      return winners.length > 0
    })

  const getPotLabel = (potIndex: number): string => (potIndex === 0 ? 'Main Pot' : `Side Pot ${potIndex}`)

  const buildSelections = (): SidePotWinnerSelection[] =>
    contestedPots.map((sidePot) => ({
      potIndex: sidePot.index,
      winnerUids: selectedByPot[sidePot.index] ?? [],
    }))

  return (
    <Panel>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
        Showdown Settlement
      </h2>
      <p className="mb-3 text-sm text-slate-300">Pot: {formatChips(room.pot)}</p>

      {error ? <ErrorBanner message={error} /> : null}

      {sidePots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-sm text-slate-300">
          No side pots to settle.
        </p>
      ) : (
        <div className="space-y-2">
          {sidePots.map((sidePot) => {
            const eligiblePlayers = sidePot.eligibleUids
              .map((uid) => playersByUid.get(uid) ?? null)
              .filter((player): player is PlayerDoc => player !== null)
            const singleWinner = eligiblePlayers.length === 1 ? eligiblePlayers[0] : null

            return (
              <section
                key={sidePot.index}
                className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-100">{getPotLabel(sidePot.index)}</p>
                  <p className="text-xs text-slate-300">{formatChips(sidePot.amount)}</p>
                </div>

                {singleWinner ? (
                  <p className="text-xs text-slate-300">
                    Auto-awarded to <span className="font-semibold text-slate-100">{singleWinner.displayName}</span>.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eligiblePlayers.map((player) => (
                      <label
                        key={`${sidePot.index}-${player.uid}`}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/25 px-3 py-2"
                      >
                        <span>{player.displayName}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-emerald-400"
                          checked={(selectedByPot[sidePot.index] ?? []).includes(player.uid)}
                          onChange={() => toggle(sidePot.index, player.uid)}
                          disabled={!isHost || busy}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <div className="mt-3">
        {isHost ? (
          <Button
            disabled={busy || !canSettle}
            onClick={() => {
              void onSettle(buildSelections())
            }}
          >
            Settle Pot
          </Button>
        ) : (
          <p className="text-sm text-slate-300">Waiting for host to choose winner(s).</p>
        )}
      </div>
    </Panel>
  )
}
