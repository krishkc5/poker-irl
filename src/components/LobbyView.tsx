import { useMemo, useState } from 'react'
import type { PlayerDoc, RoomDoc, RoomSettingsInput } from '../types/game'
import { formatChips } from '../utils/format'
import { Button, ErrorBanner, NumberInput, Panel } from './Ui'

interface LobbyViewProps {
  room: RoomDoc
  players: PlayerDoc[]
  currentUid: string
  operationError: string | null
  busy: boolean
  onUpdateSettings: (settings: RoomSettingsInput) => Promise<void>
  onAutoAssignSeats: () => Promise<void>
  onStartGame: () => Promise<void>
  onRemovePlayer: (uid: string) => Promise<void>
}

export const LobbyView = ({
  room,
  players,
  currentUid,
  operationError,
  busy,
  onUpdateSettings,
  onAutoAssignSeats,
  onStartGame,
  onRemovePlayer,
}: LobbyViewProps) => {
  const [startingStack, setStartingStack] = useState(room.startingStack.toString())
  const [smallBlind, setSmallBlind] = useState(room.smallBlind.toString())
  const [bigBlind, setBigBlind] = useState(room.bigBlind.toString())

  const isHost = room.hostUid === currentUid

  const canStart = players.length >= 2

  const orderedPlayers = useMemo(
    () =>
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

        return (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0)
      }),
    [players],
  )

  const submitSettings = async () => {
    const parsedSettings: RoomSettingsInput = {
      startingStack: Number.parseInt(startingStack, 10),
      smallBlind: Number.parseInt(smallBlind, 10),
      bigBlind: Number.parseInt(bigBlind, 10),
    }

    await onUpdateSettings(parsedSettings)
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Players ({players.length})
          </h2>
          <p className="text-xs text-slate-300">Need at least 2 players to start</p>
        </div>

        <div className="space-y-2">
          {orderedPlayers.map((player) => {
            const canRemove = isHost && player.uid !== currentUid
            return (
              <article
                key={player.uid}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {player.displayName}
                    {player.uid === currentUid ? ' (you)' : ''}
                    {player.uid === room.hostUid ? ' • host' : ''}
                  </p>
                  <p className="text-xs text-slate-300">
                    Seat: {player.seat ?? 'unassigned'} • Stack: {formatChips(player.stack)}
                  </p>
                </div>
                {canRemove ? (
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Remove ${player.displayName} from the room?`)) {
                        return
                      }

                      void onRemovePlayer(player.uid)
                    }}
                  >
                    Remove
                  </Button>
                ) : null}
              </article>
            )
          })}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
          Host Controls
        </h2>

        {!isHost ? (
          <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-sm text-slate-300">
            Waiting for host to configure blinds and start the game.
          </p>
        ) : (
          <div className="space-y-3">
            {operationError ? <ErrorBanner message={operationError} /> : null}

            <label className="block text-xs text-slate-300" htmlFor="starting-stack">
              Starting stack
            </label>
            <NumberInput
              id="starting-stack"
              min={1}
              value={startingStack}
              onChange={(event) => setStartingStack(event.target.value)}
            />

            <label className="block text-xs text-slate-300" htmlFor="small-blind">
              Small blind
            </label>
            <NumberInput
              id="small-blind"
              min={1}
              value={smallBlind}
              onChange={(event) => setSmallBlind(event.target.value)}
            />

            <label className="block text-xs text-slate-300" htmlFor="big-blind">
              Big blind
            </label>
            <NumberInput
              id="big-blind"
              min={1}
              value={bigBlind}
              onChange={(event) => setBigBlind(event.target.value)}
            />

            <div className="flex flex-wrap gap-2 pt-1">
              <Button variant="secondary" disabled={busy} onClick={() => void submitSettings()}>
                Save Settings
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void onAutoAssignSeats()}>
                Auto Assign Seats
              </Button>
              <Button
                disabled={busy || !canStart}
                onClick={() => {
                  if (!canStart) {
                    return
                  }

                  void onStartGame()
                }}
              >
                Start Game
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
