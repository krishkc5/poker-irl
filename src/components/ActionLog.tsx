import type { ActionDoc } from '../types/game'
import { formatTimestamp } from '../utils/format'
import { Panel } from './Ui'

export const ActionLog = ({ actions }: { actions: ActionDoc[] }) => (
  <Panel>
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Action Log</h2>
      <p className="text-xs text-slate-300">Newest at bottom</p>
    </div>

    <div className="max-h-80 space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
      {actions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/15 px-3 py-4 text-center text-slate-300">
          No actions yet.
        </p>
      ) : (
        actions.map((action) => (
          <div key={action.id} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <p className="font-medium text-emerald-100">{action.message}</p>
            <p className="text-[11px] text-slate-400">{formatTimestamp(action.createdAt)}</p>
          </div>
        ))
      )}
    </div>
  </Panel>
)
