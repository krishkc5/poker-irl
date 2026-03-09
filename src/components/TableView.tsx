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
  const isShowdown = room.street === 'showdown'
  const tableHint = currentPlayer ? getActionHint(room, currentPlayer, players) : 'Join this room to play.'
  const statusLine =
    isShowdown
      ? 'Showdown is ready. Scroll below the table to settle the pot.'
      : actingPlayer
        ? `${actingPlayer.displayName} is acting.`
        : 'Waiting for the next action.'
  const interactionPanel =
    canCurrentPlayerAct && currentPlayer ? (
      <ActionControls
        room={room}
        currentPlayer={currentPlayer}
        busy={busy}
        error={operationError}
        onAction={onSubmitAction}
      />
    ) : (
      <Panel className="table-pulse-dock border-white/8 bg-[linear-gradient(180deg,rgba(11,17,15,0.92),rgba(8,13,12,0.98))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/75">
              Table Pulse
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--table-accent-ice)]">{statusLine}</p>
          </div>
          <Badge tone={getStreetTone(room.street)}>{room.street}</Badge>
        </div>

        <p className="mt-3 rounded-2xl border border-white/8 bg-black/20 px-4 py-3 text-sm text-slate-300">
          {tableHint}
        </p>
      </Panel>
    )

  return (
    <div className="table-view-grid">
      <div className="table-view-main space-y-4">
        <PlayersTable room={room} players={players} currentUid={currentUid} />
      </div>

      <div className="table-view-dock">
        {interactionPanel}
      </div>

      <div className="table-view-secondary">
        <div className="space-y-4">
          {isShowdown ? (
            <ShowdownPanel
              room={room}
              players={players}
              isHost={isHost}
              busy={busy}
              error={operationError}
              onSettle={onSettleShowdown}
            />
          ) : null}

          <Panel className="bg-[linear-gradient(180deg,rgba(12,19,17,0.95),rgba(8,12,11,0.98))]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
                  Table Rail
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--table-accent-ice)]">Hand Controls</h2>
              </div>
              <Badge tone={getStreetTone(room.street)}>{room.street}</Badge>
            </div>

            <div className="mb-4 grid gap-2 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Pot</p>
                <p className="mt-1 text-lg font-semibold text-[var(--table-accent-ice)]">{formatChips(room.pot)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Bet To Call</p>
                <p className="mt-1 text-lg font-semibold text-[var(--table-accent-ice)]">{formatChips(room.currentBet)}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Turn</p>
                <p className="mt-1 text-lg font-semibold text-[var(--table-accent-ice)]">
                  {actingPlayer ? actingPlayer.displayName : room.street === 'showdown' ? 'Showdown' : 'None'}
                </p>
              </div>
            </div>

            {!isHost ? (
              <p className="rounded-2xl border border-dashed border-white/12 px-4 py-4 text-sm text-slate-300">
                Host controls hand start, manual street advance, and hand reset.
              </p>
            ) : (
              <div className="space-y-2">
                <Button
                  className="w-full justify-start"
                  disabled={busy || room.pot > 0}
                  onClick={() => {
                    void onStartNewHand()
                  }}
                >
                  Start New Hand
                </Button>
                <Button
                  variant="secondary"
                  className="w-full justify-start"
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
                  className="w-full justify-start"
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

            <div className="table-history-scroll max-h-72 space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
              {hands.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-white/12 px-3 py-4 text-center text-slate-300">
                  No settled hands yet.
                </p>
              ) : (
                hands.map((hand) => (
                  <article
                    key={hand.id}
                    className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"
                  >
                    <p className="font-semibold text-emerald-100">Hand #{hand.handNumber}</p>
                    <p className="mt-1 text-slate-300">{hand.summary}</p>
                    <p className="mt-1 text-slate-200">Pot: {formatChips(hand.pot)}</p>
                    <p className="text-[11px] text-slate-400">{formatTimestamp(hand.settledAt)}</p>
                  </article>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
