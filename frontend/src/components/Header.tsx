import { useSim } from '../store'

export default function Header() {
  const { snap, online, busy, reset } = useSim()
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-ink-900 px-4 py-2">
      <div className="flex items-center gap-2.5">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" fill="#0b1322" stroke="#243653" />
          <path d="M5 21c4-8 8-8 10 0s6 8 11-2" fill="none" stroke="#3fd0e8" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="16" cy="9" r="2.4" fill="#f2b84b" />
        </svg>
        <div className="leading-tight">
          <div className="text-[17px] font-bold tracking-wide">Qavorynth AI</div>
          <div className="hidden text-[11px] text-fg-muted lg:block">Predict the danger. Protect the people. Find the safest way out.</div>
        </div>
      </div>
      <span className="chip border-warn/50 bg-warn/10 text-warn" title={snap?.city.disclaimer}>Demo environment · synthetic data</span>
      <div className="min-w-0 text-[13px]">
        <span className="text-fg-muted">Scenario </span>
        <span className="font-semibold">{snap?.scenario.name ?? '—'}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[13px]" role="status" aria-live="polite">
          <span className={`inline-block h-2 w-2 ${online ? 'bg-safe' : 'bg-crit'}`} aria-hidden="true" />
          API {online ? 'connected' : 'offline'}
        </div>
        <button className="btn" onClick={() => void reset()} disabled={busy || !online}>Reset scenario</button>
      </div>
    </header>
  )
}
