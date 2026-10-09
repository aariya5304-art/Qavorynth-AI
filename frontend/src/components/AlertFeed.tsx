import { useSim } from '../store'
import Panel, { Empty } from './Panel'

const GLYPH = { critical: '▲', warning: '●', info: '○' } as const
const TONE = { critical: 'text-crit', warning: 'text-warn', info: 'text-fg-muted' } as const
const WORD = { critical: 'Critical', warning: 'Warning', info: 'Info' } as const

export default function AlertFeed({ className = '' }: { className?: string }) {
  const { snap, selectZone } = useSim()
  if (!snap) return null
  return (
    <Panel title="Alerts" className={className} bodyClass="overflow-auto"
      right={<span className="text-[12px] text-fg-muted">{snap.metrics.active_alerts} active</span>}>
      {snap.alerts.length === 0 ? <Empty>No alerts under the current conditions.</Empty> : (
        <ul className="divide-y divide-line">
          {snap.alerts.map((a) => {
            const content = (
              <>
                <span className={`mt-0.5 w-4 shrink-0 text-center text-[12px] ${TONE[a.severity]}`} aria-hidden="true">{GLYPH[a.severity]}</span>
                <span className="min-w-0 text-left">
                  <span className="block text-[13px] font-semibold"><span className="sr-only">{WORD[a.severity]}: </span>{a.title}</span>
                  <span className="block text-[12px] leading-snug text-fg-muted">{a.detail}</span>
                </span>
              </>
            )
            const isZone = a.ref !== null && snap.zones.some((z) => z.id === a.ref)
            return (
              <li key={a.id}>
                {isZone ? (
                  <button className="flex w-full gap-2 px-3 py-2 hover:bg-ink-800" onClick={() => selectZone(a.ref)}>{content}</button>
                ) : (
                  <div className="flex gap-2 px-3 py-2">{content}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
