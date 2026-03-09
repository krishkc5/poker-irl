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
  const hostName = useMemo(
    () => players.find((player) => player.uid === room.hostUid)?.displayName ?? 'the host',
    [players, room.hostUid],
  )
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

  const formatNameList = (names: string[]): string => {
    if (names.length === 0) {
      return 'nobody'
    }

    if (names.length === 1) {
      return names[0]
    }

    if (names.length === 2) {
      return `${names[0]} & ${names[1]}`
    }

    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
  }

  const getPotLabel = (potIndex: number, names: string[]): string =>
    potIndex === 0
      ? `Main Pot between ${formatNameList(names)}`
      : `Side Pot between ${formatNameList(names)}`

  const buildSelections = (): SidePotWinnerSelection[] =>
    contestedPots.map((sidePot) => ({
      potIndex: sidePot.index,
      winnerUids: selectedByPot[sidePot.index] ?? [],
    }))

  return (
    <Panel className="bg-[linear-gradient(180deg,rgba(13,19,17,0.95),rgba(8,12,11,0.98))]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
            Showdown
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--table-accent-ice)]">
            Settlement Panel
          </h2>
        </div>
        <p className="rounded-full border border-white/8 bg-black/20 px-3 py-2 text-sm text-slate-300">
          Pot: <span className="font-semibold text-slate-100">{formatChips(room.pot)}</span>
        </p>
      </div>

      {sidePots.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 px-3 py-4 text-sm text-slate-300">
          No side pots to settle.
        </p>
      ) : (
        <div className="space-y-2">
          {sidePots.map((sidePot) => {
            const eligiblePlayers = sidePot.eligibleUids
              .map((uid) => playersByUid.get(uid) ?? null)
              .filter((player): player is PlayerDoc => player !== null)
            const singleWinner = eligiblePlayers.length === 1 ? eligiblePlayers[0] : null
            const potLabel = getPotLabel(
              sidePot.index,
              eligiblePlayers.map((player) => player.displayName),
            )

            return (
              <section
                key={sidePot.index}
                className="rounded-[1.35rem] border border-white/8 bg-black/20 px-3 py-3 text-sm"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-100">{potLabel}</p>
                  <p className="rounded-full border border-white/8 bg-black/25 px-3 py-1 text-xs text-slate-300">
                    {formatChips(sidePot.amount)}
                  </p>
                </div>

                {singleWinner ? (
                  <p className="text-xs text-slate-300">
                    Auto-awarded to <span className="font-semibold text-slate-100">{singleWinner.displayName}</span>.
                  </p>
                ) : !isHost ? (
                  <p className="text-xs text-slate-300">
                    Waiting for <span className="font-semibold text-slate-100">{hostName}</span> to settle this pot.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {eligiblePlayers.map((player) => (
                      <label
                        key={`${sidePot.index}-${player.uid}`}
                        className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/8 bg-black/25 px-3 py-2.5"
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
          <>
            {error ? <ErrorBanner message={error} /> : null}
            <div className={error ? 'mt-3' : ''}>
              <Button
                disabled={busy || !canSettle}
                onClick={() => {
                  void onSettle(buildSelections())
                }}
              >
                Settle Pot
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-300">
            Waiting for <span className="font-semibold text-slate-100">{hostName}</span> to settle the pot.
          </p>
        )}
      </div>
    </Panel>
  )
}
