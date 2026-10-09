import { useSim } from '../store'
import { fmtInt, riskLabel } from '../lib/format'
import Panel, { Bar, Chip, Empty } from './Panel'

const NAMES: Record<string, string> = {
  rainfall: 'Rainfall', water_level: 'Water level', low_elevation: 'Low elevation', population_exposure: 'Population exposure',
}

export default function ZonePanel() {
  const { snap, selectedZoneId, horizon } = useSim()
  const zone = snap?.zones.find((z) => z.id === selectedZoneId)
  if (!snap) return null
  if (!zone) {
    return <Panel title="Selected zone"><Empty>Select a zone on the map or from the table to see its risk breakdown.</Empty></Panel>
  }
  const r = zone.risk
  const fc = snap.forecast.zones[zone.id] ?? []
  return (
    <Panel title={`Zone: ${zone.name}`} right={<Chip tone={r.classification}>{riskLabel[r.classification]} · {r.score.toFixed(1)}</Chip>}>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
        <dt className="text-fg-muted">Population</dt><dd>{fmtInt(zone.population)}</dd>
        <dt className="text-fg-muted">Density</dt><dd>{fmtInt(zone.density_per_km2)} /km²</dd>
        <dt className="text-fg-muted">Mean elevation</dt><dd>{zone.mean_elevation_m} m</dd>
        <dt className="text-fg-muted">River proximity</dt><dd>{zone.river_proximity.toFixed(2)}</dd>
      </dl>
      <h3 className="mb-1 mt-3 text-[12px] font-semibold text-fg-muted">Score components (now)</h3>
      <ul className="space-y-2">
        {Object.entries(r.components).map(([k, c]) => (
          <li key={k}>
            <div className="flex justify-between text-[12.5px]">
              <span>{NAMES[k] ?? k}{c.imputed ? ' (imputed)' : ''}</span>
              <span className="text-fg-muted">{c.normalized.toFixed(1)} × {c.weight.toFixed(2)} = <b className="text-fg">{c.contribution.toFixed(1)}</b></span>
            </div>
            <Bar pct={c.normalized} tone={c.normalized >= 65 ? 'high' : c.normalized >= 35 ? 'medium' : 'low'} />
            <div className="text-[11px] text-fg-dim">
              Input {c.input === null ? 'missing' : `${c.input.toFixed(1)} ${c.unit}`} · {c.rule}
            </div>
          </li>
        ))}
      </ul>
      <h3 className="mb-1 mt-3 text-[12px] font-semibold text-fg-muted">Modelled risk, next 3 hours (80% band)</h3>
      <table className="w-full text-[12.5px]">
        <thead><tr><th className="th">Time</th><th className="th">Low</th><th className="th">Mid</th><th className="th">High</th><th className="th">Class</th></tr></thead>
        <tbody>
          {fc.map((p) => (
            <tr key={p.h} className={p.h === horizon ? 'bg-cyanx/10' : ''}>
              <td className="td">{p.h === 0 ? 'Now' : `+${p.h} h`}</td>
              <td className="td">{p.lo.toFixed(1)}</td><td className="td font-semibold">{p.mid.toFixed(1)}</td><td className="td">{p.hi.toFixed(1)}</td>
              <td className="td"><Chip tone={p.classification}>{riskLabel[p.classification]}</Chip></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11.5px] leading-snug text-fg-dim">{r.explanation}</p>
      {r.warnings.map((w) => <p key={w} className="mt-1 text-[12px] text-warn">{w}</p>)}
    </Panel>
  )
}
