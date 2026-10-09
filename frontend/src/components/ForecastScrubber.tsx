import { useSim } from '../store'

const OPTIONS = [
  { h: 0, label: 'Now' },
  { h: 1, label: '+1 h' },
  { h: 2, label: '+2 h' },
  { h: 3, label: '+3 h' },
]

export default function ForecastScrubber() {
  const { horizon, setHorizon } = useSim()
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-ink-900 px-3 py-2">
      <div role="radiogroup" aria-label="Risk time horizon" className="flex">
        {OPTIONS.map((o) => (
          <button
            key={o.h}
            role="radio"
            aria-checked={horizon === o.h}
            onClick={() => setHorizon(o.h)}
            className={`border border-line px-3 py-1 text-[13px] font-medium -ml-px first:ml-0 ${
              horizon === o.h ? 'border-cyanx bg-cyanx/15 text-cyanx' : 'bg-ink-800 text-fg-muted hover:text-fg'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-fg-muted">
        {horizon === 0
          ? 'Zone colours show risk under current conditions.'
          : `Zone colours show modelled risk at +${horizon} h. The model is trained on synthetic data and is a demonstration, not a warning.`}
      </p>
    </div>
  )
}
