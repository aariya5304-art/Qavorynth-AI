import { useState } from 'react'
import { useSim } from '../store'
import Panel, { Bar, Chip } from '../components/Panel'
import { facilityStatusLabel, fmtInt } from '../lib/format'

export default function SheltersView() {
  const { snap } = useSim()
  const [kind, setKind] = useState<'all' | 'shelter' | 'hospital'>('all')
  if (!snap) return null
  const list = snap.facilities.filter((f) => kind === 'all' || f.kind === kind)
  const m = snap.metrics
  return (
    <div className="space-y-3 p-3">
      <Panel title="Shelters & facilities" right={
        <div role="radiogroup" aria-label="Facility type" className="flex">
          {(['all', 'shelter', 'hospital'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
              className={`-ml-px border border-line px-2.5 py-0.5 text-[12px] first:ml-0 ${kind === k ? 'border-cyanx bg-cyanx/15 text-cyanx' : 'bg-ink-800 text-fg-muted'}`}>
              {k === 'all' ? 'All' : k === 'shelter' ? 'Shelters' : 'Hospitals'}
            </button>
          ))}
        </div>} bodyClass="overflow-auto p-0">
        <p className="px-3 py-2 text-[12.5px] text-fg-muted">
          {fmtInt(m.available_shelter_capacity)} shelter places free across {m.operational_shelters} of {m.total_shelters} operating shelters. A facility is unavailable when site flood depth reaches the unsafe limit.
        </p>
        <table className="w-full min-w-[760px]">
          <thead><tr><th className="th">Facility</th><th className="th">Type</th><th className="th">Status</th><th className="th w-48">Occupancy</th><th className="th">Free</th><th className="th">Step-free</th><th className="th">Site elevation</th><th className="th">Flood depth</th></tr></thead>
          <tbody>
            {list.map((f) => {
              const tone = f.status === 'flooded' || f.status === 'full' ? 'high' : f.status === 'near_full' ? 'medium' : 'low'
              return (
                <tr key={f.id} className="border-t border-line">
                  <td className="td font-semibold">{f.name}</td>
                  <td className="td">{f.kind === 'shelter' ? 'Shelter' : 'Hospital'}</td>
                  <td className="td"><Chip tone={tone}>{facilityStatusLabel[f.status]}</Chip></td>
                  <td className="td"><Bar pct={f.occupancy_pct} tone={tone === 'low' ? 'info' : tone} /><span className="text-[11.5px] text-fg-muted">{fmtInt(f.occupancy)} / {fmtInt(f.capacity)} ({f.occupancy_pct.toFixed(0)}%)</span></td>
                  <td className="td">{fmtInt(f.available)}</td>
                  <td className="td">{f.step_free ? 'Yes' : 'No'}</td>
                  <td className="td">{f.elevation_m} m</td>
                  <td className="td">{f.flood_depth_m.toFixed(2)} m</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
