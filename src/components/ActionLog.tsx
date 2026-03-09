import type { ActionDoc } from '../types/game'
import { formatTimestamp } from '../utils/format'
import { Panel } from './Ui'

export const ActionLog = ({ actions }: { actions: ActionDoc[] }) => (
  <Panel className="action-log-panel bg-[linear-gradient(180deg,rgba(10,15,14,0.95),rgba(6,10,9,0.98))]">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200">Action Log</h2>
      <p className="text-xs text-slate-400">Newest at bottom</p>
    </div>

    <div className="action-log-scroll max-h-80 space-y-2 overflow-y-auto pr-1 text-xs text-slate-200">
      {actions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 px-3 py-4 text-center text-slate-300">
          No actions yet.
        </p>
      ) : (
        actions.map((action) => (
          <div
            key={action.id}
            className="rounded-2xl border border-white/8 bg-black/20 px-3 py-3"
          >
            <p className="font-medium text-emerald-100">{action.message}</p>
            <p className="text-[11px] text-slate-400">{formatTimestamp(action.createdAt)}</p>
          </div>
        ))
      )}
    </div>
  </Panel>
)
