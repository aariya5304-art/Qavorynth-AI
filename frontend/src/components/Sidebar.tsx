import type { ViewId } from '../types'

const ITEMS: { id: ViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'map', label: 'Risk Map' },
  { id: 'evacuation', label: 'Evacuation Planning' },
  { id: 'shelters', label: 'Shelters & Facilities' },
  { id: 'simulator', label: 'Scenario Simulator' },
  { id: 'log', label: 'Event Log' },
  { id: 'method', label: 'Methodology' },
]

export default function Sidebar({ view, onChange }: { view: ViewId; onChange: (v: ViewId) => void }) {
  return (
    <nav aria-label="Main" className="shrink-0 border-b border-line bg-ink-900 md:w-52 md:border-b-0 md:border-r">
      <ul className="flex gap-0 overflow-x-auto md:flex-col md:py-2">
        {ITEMS.map((it) => {
          const active = it.id === view
          return (
            <li key={it.id} className="shrink-0">
              <button
                onClick={() => onChange(it.id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full whitespace-nowrap border-b-2 px-4 py-2.5 text-left text-[14px] md:border-b-0 md:border-l-2 ${
                  active ? 'border-cyanx bg-cyanx/10 font-semibold text-cyanx' : 'border-transparent text-fg-muted hover:bg-ink-800 hover:text-fg'
                }`}
              >
                {it.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
