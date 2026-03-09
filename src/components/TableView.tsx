import { useMemo } from 'react'
import { getActionHint } from '../lib/firestoreApi'
import { isPlayerAbleToAct } from '../lib/gameEngine'
import type { ActionDoc, HandDoc, PlayerDoc, RoomDoc, SidePotWinnerSelection } from '../types/game'
import { formatChips, formatTimestamp } from '../utils/format'
import { ActionControls } from './ActionControls'
import { ActionLog } from './ActionLog'
import { PlayersTable } from './PlayersTable'
import { ShowdownPanel } from './ShowdownPanel'
import { Badge, Button, Panel } from './Ui'

interface TableViewProps {
  room: RoomDoc
  players: PlayerDoc[]
  actions: ActionDoc[]
  hands: HandDoc[]
  currentUid: string
  busy: boolean
  operationError: string | null
  onSubmitAction: (input: { type: 'check' | 'call' | 'bet' | 'raise' | 'fold' | 'all_in'; amount?: number }) => Promise<void>
  onStartNewHand: () => Promise<void>
  onAdvanceStreet: () => Promise<void>
  onResetHand: () => Promise<void>
  onSettleShowdown: (selections: SidePotWinnerSelection[]) => Promise<void>
}

const getStreetTone = (street: RoomDoc['street']): 'neutral' | 'success' | 'warning' | 'danger' => {
  if (street === 'showdown') {
    return 'warning'
  }

  if (street === 'river') {
    return 'danger'
  }

  if (street === 'turn') {
    return 'warning'
  }

  return 'success'
}

export const TableView = ({
  room,
  players,
  actions,
  hands,
  currentUid,
  busy,
  operationError,
  onSubmitAction,
  onStartNewHand,
  onAdvanceStreet,
  onResetHand,
  onSettleShowdown,
}: TableViewProps) => {
  const currentPlayer = useMemo(
    () => players.find((player) => player.uid === currentUid) ?? null,
    [currentUid, players],
  )

  const actingPlayer = useMemo(
    () => players.find((player) => player.seat === room.currentTurnSeat) ?? null,
    [players, room.currentTurnSeat],
  )

  const canCurrentPlayerAct =
    currentPlayer !== null &&
    currentPlayer.seat === room.currentTurnSeat &&
    room.street !== 'showdown' &&
    isPlayerAbleToAct(currentPlayer)

  const isHost = room.hostUid === currentUid

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Panel>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
              Table State
            </h2>
            <Badge tone={getStreetTone(room.street)}>{room.street}</Badge>
          </div>

          <div className="grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
            <p>
              Pot: <span className="font-semibold">{formatChips(room.pot)}</span>
            </p>
            <p>
              Bet to call: <span className="font-semibold">{formatChips(room.currentBet)}</span>
            </p>
            <p>
              Hand #: <span className="font-semibold">{room.handNumber}</span>
            </p>
            <p>
              Turn:{' '}
              <span className="font-semibold">
                {actingPlayer ? actingPlayer.displayName : room.street === 'showdown' ? 'Showdown' : 'None'}
              </span>
            </p>
          </div>

          <p className="mt-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
            {currentPlayer ? getActionHint(room, currentPlayer, players) : 'Join this room to play.'}
          </p>
        </Panel>

        <Panel>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Seats & Stacks
          </h2>
          <PlayersTable room={room} players={players} currentUid={currentUid} />
        </Panel>

        {canCurrentPlayerAct && currentPlayer ? (
          <ActionControls
            room={room}
            currentPlayer={currentPlayer}
            busy={busy}
            error={operationError}
            onAction={onSubmitAction}
          />
        ) : null}

        {room.street === 'showdown' ? (
          <ShowdownPanel
            room={room}
            players={players}
            isHost={isHost}
            busy={busy}
            error={operationError}
            onSettle={onSettleShowdown}
          />
        ) : null}
      </div>

      <div className="space-y-4">
        <Panel>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Hand Controls
          </h2>

          {!isHost ? (
            <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-sm text-slate-300">
              Host controls hand start, manual street advance, and hand reset.
            </p>
          ) : (
            <div className="space-y-2">
              <Button
                disabled={busy || room.pot > 0}
                onClick={() => {
                  void onStartNewHand()
                }}
              >
                Start New Hand
              </Button>
              <Button
                variant="secondary"
                disabled={busy || room.street === 'showdown'}
                onClick={() => {
                  if (!window.confirm('Advance to the next street?')) {
                    return
                  }

                  void onAdvanceStreet()
                }}
              >
                Advance Street
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm('Reset current hand and refund all contributions?')) {
                    return
                  }

                  void onResetHand()
                }}
              >
                Reset Hand
              </Button>
            </div>
          )}
        </Panel>

        <ActionLog actions={actions} />

        <Panel>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">
            Hand History
          </h2>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
            {hands.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-slate-300">
                No settled hands yet.
              </p>
            ) : (
              hands.map((hand) => (
                <article key={hand.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                  <p className="font-semibold text-emerald-100">Hand #{hand.handNumber}</p>
                  <p>{hand.summary}</p>
                  <p>Pot: {formatChips(hand.pot)}</p>
                  <p className="text-[11px] text-slate-400">{formatTimestamp(hand.settledAt)}</p>
                </article>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
