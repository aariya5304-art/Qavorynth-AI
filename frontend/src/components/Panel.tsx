import { ReactNode } from 'react'

export default function Panel({ title, right, children, className = '', bodyClass = 'p-3' }: {
  title: string; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string
}) {
  return (
    <section className={`panel flex min-h-0 flex-col ${className}`} aria-label={title}>
      <header className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {right}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClass}`}>{children}</div>
    </section>
  )
}

export function Chip({ children, tone }: { children: ReactNode; tone: 'low' | 'medium' | 'high' | 'info' | 'muted' }) {
  const cls = {
    low: 'border-safe/50 text-safe bg-safe/10',
    medium: 'border-warn/50 text-warn bg-warn/10',
    high: 'border-crit/50 text-crit bg-crit/10',
    info: 'border-cyanx-dim text-cyanx bg-cyanx/10',
    muted: 'border-line text-fg-muted bg-ink-800',
  }[tone]
  return <span className={`chip ${cls}`}>{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-1 py-4 text-center text-[13px] text-fg-dim">{children}</p>
}

export function Bar({ pct, tone = 'info' }: { pct: number; tone?: 'low' | 'medium' | 'high' | 'info' }) {
  const color = { low: 'bg-safe', medium: 'bg-warn', high: 'bg-crit', info: 'bg-cyanx' }[tone]
  return (
    <div className="h-1.5 w-full bg-ink-700" role="presentation">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  )
}
