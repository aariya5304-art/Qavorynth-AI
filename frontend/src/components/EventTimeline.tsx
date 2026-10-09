import { useSim } from '../store'
import { fmtTime } from '../lib/format'
import type { SimEvent } from '../types'
import Panel, { Empty } from './Panel'

export function EventItem({ e }: { e: SimEvent }) {
  return (
    <li className="border-l-2 border-cyanx-dim pl-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] text-fg-dim">{fmtTime(e.timestamp)}</span>
        <span className="text-[13px] font-semibold">{e.title}</span>
      </div>
      <p className="text-[12px] leading-snug text-fg-muted">{e.detail}</p>
    </li>
  )
}

export default function EventTimeline({ className = '' }: { className?: string }) {
  const { snap } = useSim()
  if (!snap) return null
  return (
    <Panel title="Recent events" className={className} bodyClass="overflow-auto">
      {snap.recent_events.length === 0 ? <Empty>No events recorded yet.</Empty> : (
        <ol className="space-y-3">{snap.recent_events.map((e) => <EventItem key={e.id} e={e} />)}</ol>
      )}
    </Panel>
  )
}
