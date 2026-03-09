import { useMemo, useState } from 'react'
import type { PlayerDoc, RoomDoc } from '../types/game'
import { formatChips } from '../utils/format'
import { Button, ErrorBanner, Panel } from './Ui'

interface ShowdownPanelProps {
  room: RoomDoc
  players: PlayerDoc[]
  isHost: boolean
  busy: boolean
  error: string | null
  onSettle: (winnerUids: string[]) => Promise<void>
}

export const ShowdownPanel = ({
  room,
  players,
  isHost,
  busy,
  error,
  onSettle,
}: ShowdownPanelProps) => {
  const candidates = useMemo(
    () => players.filter((player) => player.inHand && !player.folded),
    [players],
  )

  const [selected, setSelected] = useState<string[]>([])

  const toggle = (uid: string) => {
    setSelected((current) =>
      current.includes(uid) ? current.filter((entry) => entry !== uid) : [...current, uid],
    )
  }

  return (
    <Panel>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
        Showdown Settlement
      </h2>
      <p className="mb-3 text-sm text-slate-300">Pot: {formatChips(room.pot)}</p>

      {error ? <ErrorBanner message={error} /> : null}

      {candidates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-sm text-slate-300">
          No eligible showdown players.
        </p>
      ) : (
        <div className="space-y-2">
          {candidates.map((player) => (
            <label
              key={player.uid}
              className="flex cursor-pointer items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
            >
              <span>{player.displayName}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-400"
                checked={selected.includes(player.uid)}
                onChange={() => toggle(player.uid)}
                disabled={!isHost || busy}
              />
            </label>
          ))}
        </div>
      )}

      <div className="mt-3">
        {isHost ? (
          <Button
            disabled={busy || selected.length === 0 || room.pot <= 0}
            onClick={() => {
              void onSettle(selected)
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
