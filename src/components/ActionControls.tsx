import { useEffect, useMemo, useState } from 'react'
import { getLegalActions } from '../lib/gameEngine'
import type { ActionInput, PlayerDoc, RoomDoc } from '../types/game'
import { formatChips } from '../utils/format'
import { Button, ErrorBanner, NumberInput, Panel } from './Ui'

interface ActionControlsProps {
  room: RoomDoc
  currentPlayer: PlayerDoc
  busy: boolean
  error: string | null
  onAction: (input: ActionInput) => Promise<void>
}

export const ActionControls = ({
  room,
  currentPlayer,
  busy,
  error,
  onAction,
}: ActionControlsProps) => {
  const legal = useMemo(() => getLegalActions(room, currentPlayer), [currentPlayer, room])

  const [amount, setAmount] = useState(() => {
    if (room.currentBet > 0) {
      return legal.minimumRaiseTo.toString()
    }

    return legal.minimumBet.toString()
  })

  const isRaiseMode = room.currentBet > 0

  useEffect(() => {
    if (isRaiseMode) {
      setAmount(legal.minimumRaiseTo.toString())
      return
    }

    setAmount(legal.minimumBet.toString())
  }, [isRaiseMode, legal.minimumBet, legal.minimumRaiseTo])

  const submit = async (type: ActionInput['type']) => {
    if (type === 'bet' || type === 'raise') {
      const parsed = Number.parseInt(amount, 10)
      await onAction({ type, amount: parsed })
      return
    }

    await onAction({ type })
  }

  return (
    <Panel className="action-dock-panel bg-[linear-gradient(180deg,rgba(13,19,17,0.95),rgba(7,11,10,0.98))]">
      <div className="action-dock-header mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/75">
            Action Dock
          </p>
          <h2 className="action-dock-title mt-1 text-xl font-semibold text-[var(--table-accent-ice)]">
            Your move, {currentPlayer.displayName}
          </h2>
        </div>
        <p className="action-dock-call rounded-full border border-white/8 bg-black/20 px-3 py-2 text-xs text-slate-300">
          To call: <span className="font-semibold text-slate-100">{formatChips(legal.amountToCall)}</span>
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="action-dock-actions grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button className="h-12" disabled={!legal.canCheck || busy} onClick={() => void submit('check')}>
          Check
        </Button>
        <Button className="h-12" disabled={!legal.canCall || busy} onClick={() => void submit('call')}>
          Call
        </Button>
        <Button
          className="h-12"
          variant="danger"
          disabled={!legal.canFold || busy}
          onClick={() => void submit('fold')}
        >
          Fold
        </Button>
        <Button
          className="h-12"
          variant="secondary"
          disabled={!legal.canAllIn || busy}
          onClick={() => void submit('all_in')}
        >
          All In
        </Button>
      </div>

      <div className="action-dock-raise mt-4 rounded-[1.4rem] border border-white/8 bg-black/20 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label className="block text-xs text-slate-300" htmlFor="bet-amount">
            {isRaiseMode
              ? `Raise to (min ${formatChips(legal.minimumRaiseTo)})`
              : `Bet amount (min ${formatChips(legal.minimumBet)})`}
          </label>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Max {formatChips(legal.maxTotalContribution)}
          </p>
        </div>

        <div className="action-dock-raise-controls flex flex-col gap-2 sm:flex-row">
          <NumberInput
            id="bet-amount"
            min={isRaiseMode ? legal.minimumRaiseTo : legal.minimumBet}
            max={legal.maxTotalContribution}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button
            className="h-12 min-w-[9rem]"
            variant="secondary"
            disabled={busy || (isRaiseMode ? !legal.canRaise : !legal.canBet)}
            onClick={() => void submit(isRaiseMode ? 'raise' : 'bet')}
          >
            {isRaiseMode ? 'Confirm Raise' : 'Place Bet'}
          </Button>
        </div>
      </div>

      <div className="action-dock-stats mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
          <p className="uppercase tracking-[0.16em] text-slate-500">Stack Behind</p>
          <p className="mt-1 text-base font-semibold text-[var(--table-accent-ice)]">
            {formatChips(currentPlayer.stack)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
          <p className="uppercase tracking-[0.16em] text-slate-500">Street In</p>
          <p className="mt-1 text-base font-semibold text-[var(--table-accent-ice)]">
            {formatChips(currentPlayer.currentStreetContribution)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3">
          <p className="uppercase tracking-[0.16em] text-slate-500">Hand In</p>
          <p className="mt-1 text-base font-semibold text-[var(--table-accent-ice)]">
            {formatChips(currentPlayer.totalHandContribution)}
          </p>
        </div>
      </div>
    </Panel>
  )
}
