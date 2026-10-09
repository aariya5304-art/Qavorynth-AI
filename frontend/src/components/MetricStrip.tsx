import { useSim } from '../store'
import { fmtInt, signed } from '../lib/format'

export default function MetricStrip() {
  const { snap } = useSim()
  if (!snap) return null
  const m = snap.metrics
  const b = snap.baseline.metrics
  const cells: { label: string; value: string; sub: string; tone: string }[] = [
    { label: 'Monitored zones', value: fmtInt(m.total_zones), sub: `${m.low_risk_zones} low · ${m.medium_risk_zones} medium · ${m.high_risk_zones} high`, tone: '' },
    { label: 'High-risk zones', value: fmtInt(m.high_risk_zones), sub: `${signed(m.high_risk_zones - b.high_risk_zones)} vs baseline · ${fmtInt(m.population_in_high_risk)} residents`, tone: m.high_risk_zones > 0 ? 'text-crit' : 'text-safe' },
    { label: 'Blocked roads', value: fmtInt(m.blocked_roads), sub: `+ ${m.unsafe_roads} flood-unsafe · ${m.restricted_roads} restricted`, tone: m.blocked_roads + m.unsafe_roads > 0 ? 'text-warn' : '' },
    { label: 'Shelter capacity free', value: fmtInt(m.available_shelter_capacity), sub: `${signed(m.available_shelter_capacity - b.available_shelter_capacity)} vs baseline · ${m.operational_shelters}/${m.total_shelters} shelters operating`, tone: 'text-cyanx' },
    { label: 'Active alerts', value: fmtInt(m.active_alerts), sub: 'critical and warning, from current state', tone: m.active_alerts > 0 ? 'text-warn' : '' },
  ]
  return (
    <section aria-label="Operational metrics" className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 xl:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="bg-ink-900 px-3 py-2.5">
          <div className="text-[12px] font-medium text-fg-muted">{c.label}</div>
          <div className={`text-[28px] font-bold leading-tight ${c.tone}`}>{c.value}</div>
          <div className="text-[11.5px] leading-snug text-fg-dim">{c.sub}</div>
        </div>
      ))}
    </section>
  )
}
