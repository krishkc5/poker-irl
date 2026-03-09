import { useMemo, useState } from 'react'
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

  const submit = async (type: ActionInput['type']) => {
    if (type === 'bet' || type === 'raise') {
      const parsed = Number.parseInt(amount, 10)
      await onAction({ type, amount: parsed })
      return
    }

    await onAction({ type })
  }

  return (
    <Panel>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Your Action</h2>
        <p className="text-xs text-slate-300">
          To call: <span className="font-semibold text-slate-100">{formatChips(legal.amountToCall)}</span>
        </p>
      </div>

      {error ? <ErrorBanner message={error} /> : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button disabled={!legal.canCheck || busy} onClick={() => void submit('check')}>
          Check
        </Button>
        <Button disabled={!legal.canCall || busy} onClick={() => void submit('call')}>
          Call
        </Button>
        <Button variant="danger" disabled={!legal.canFold || busy} onClick={() => void submit('fold')}>
          Fold
        </Button>
        <Button variant="secondary" disabled={!legal.canAllIn || busy} onClick={() => void submit('all_in')}>
          All In
        </Button>
      </div>

      <div className="mt-4 rounded-lg border border-white/10 bg-black/20 p-3">
        <label className="mb-1 block text-xs text-slate-300" htmlFor="bet-amount">
          {isRaiseMode
            ? `Raise to (min ${formatChips(legal.minimumRaiseTo)})`
            : `Bet amount (min ${formatChips(legal.minimumBet)})`}
        </label>
        <div className="flex gap-2">
          <NumberInput
            id="bet-amount"
            min={isRaiseMode ? legal.minimumRaiseTo : legal.minimumBet}
            max={legal.maxTotalContribution}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Button
            variant="secondary"
            disabled={busy || (isRaiseMode ? !legal.canRaise : !legal.canBet)}
            onClick={() => void submit(isRaiseMode ? 'raise' : 'bet')}
          >
            {isRaiseMode ? 'Raise' : 'Bet'}
          </Button>
        </div>
      </div>
    </Panel>
  )
}
