import { useSim } from '../store'
import { facilityStatusLabel, fmtInt } from '../lib/format'
import Panel, { Bar, Chip } from './Panel'

export default function ShelterList({ className = '' }: { className?: string }) {
  const { snap } = useSim()
  if (!snap) return null
  const list = snap.facilities.filter((f) => f.kind === 'shelter')
  return (
    <Panel title="Shelter occupancy" className={className} bodyClass="overflow-auto p-0">
      <ul className="divide-y divide-line">
        {list.map((f) => {
          const tone = f.status === 'flooded' || f.status === 'full' ? 'high' : f.status === 'near_full' ? 'medium' : 'low'
          return (
            <li key={f.id} className="px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold">{f.name}</span>
                <Chip tone={tone}>{facilityStatusLabel[f.status]}</Chip>
              </div>
              <Bar pct={f.operational ? f.occupancy_pct : 100} tone={tone === 'low' ? 'info' : tone} />
              <div className="mt-0.5 text-[12px] text-fg-muted">
                {f.operational ? `${fmtInt(f.occupancy)} / ${fmtInt(f.capacity)} occupied · ${fmtInt(f.available)} free` : `Flooded, ${f.flood_depth_m.toFixed(2)} m at site · 0 usable`}
              </div>
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}
