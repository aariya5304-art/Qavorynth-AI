import { useSim } from '../store'
import { fmtInt, fmtKm, fmtMin, nodeLabel, signed } from '../lib/format'
import Panel, { Bar, Chip } from './Panel'

export default function RouteSummary({ detailed = false, className = '' }: { detailed?: boolean; className?: string }) {
  const { snap } = useSim()
  if (!snap) return null
  const r = snap.route
  const base = snap.baseline.route
  const roadsById = new Map(snap.roads.map((x) => [x.id, x]))
  const rerouted = r.status === 'ok' && base.status === 'ok' && r.road_path.join() !== base.road_path.join()
  const tone = r.status === 'ok' ? 'low' : 'high'
  return (
    <Panel title="Selected route" className={className} bodyClass="overflow-auto"
      right={<Chip tone={tone}>{r.status === 'ok' ? 'Route found' : r.status === 'no_route' ? 'No route' : 'No eligible facility'}</Chip>}>
      <p className="text-[12.5px] text-fg-muted">
        From junction <b className="text-fg">{nodeLabel(snap.nodes, r.origin_node_id)}</b> · {r.mode} mode · party of {r.party_size}
        {r.needs_step_free ? ' · step-free' : ''} · destination: {r.destination_kind}
      </p>

      {r.status !== 'ok' ? (
        <div className="mt-2 border border-crit/50 bg-crit/10 p-2.5 text-[13px] text-crit" role="alert">
          {r.message}
          <div className="mt-1 text-[12px] text-fg-muted">{r.excluded_road_count} roads are excluded (blocked, flood-unsafe{r.needs_step_free ? ' or not step-free' : ''}). Try another origin, relax the requirements, or reopen a closed road.</div>
        </div>
      ) : r.facility && (
        <>
          <h3 className="mt-2 text-[15px] font-semibold">{r.facility.name}</h3>
          <div className="mt-1.5 grid grid-cols-3 gap-2 text-center">
            <Stat label="Distance" value={fmtKm(r.total_distance_m)} />
            <Stat label="Est. time*" value={fmtMin(r.est_travel_min)} />
            <Stat label="Max road risk" value={r.max_road_risk.toFixed(0)} />
          </div>
          <div className="mt-2 text-[12px] text-fg-muted">
            Capacity: {fmtInt(r.facility.available)} free of {fmtInt(r.facility.capacity)}
            <Bar pct={(r.facility.occupancy / r.facility.capacity) * 100} />
          </div>
          {rerouted && (
            <p className="mt-2 border border-warn/50 bg-warn/10 p-2 text-[12.5px] text-warn">
              Rerouted from baseline: {base.facility?.name} ({fmtKm(base.total_distance_m)}) → {r.facility.name} ({fmtKm(r.total_distance_m)}, {signed((r.total_distance_m - base.total_distance_m) / 1000, 2)} km).
            </p>
          )}
          {!rerouted && base.status === 'ok' && <p className="mt-2 text-[12px] text-fg-dim">Same route as under baseline conditions.</p>}
          {base.status !== 'ok' && <p className="mt-2 text-[12px] text-fg-dim">No route was available under baseline conditions.</p>}
        </>
      )}

      {r.warnings.map((w) => <p key={w} className="mt-2 text-[12px] text-warn">⚠ {w}</p>)}

      {r.status === 'ok' && (
        <div className="mt-2 text-[12px] text-fg-muted">
          Path: {r.node_path.map((n) => nodeLabel(snap.nodes, n)).join(' → ')}
          {detailed && (
            <ul className="mt-1 space-y-0.5">
              {r.road_path.map((id) => {
                const road = roadsById.get(id)
                return <li key={id}>{id} · {road?.name} · {road ? fmtKm(road.distance_m) : ''} · {road?.status}</li>
              })}
            </ul>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] leading-snug text-fg-dim">*Estimate from documented speed assumptions (see Methodology), not a traffic model.</p>

      {detailed && r.alternatives.length > 0 && (
        <>
          <h3 className="mb-1 mt-3 text-[12px] font-semibold text-fg-muted">Alternative routes to the same facility</h3>
          <table className="w-full"><thead><tr><th className="th">#</th><th className="th">Distance</th><th className="th">Max risk</th><th className="th">Via</th></tr></thead>
            <tbody>{r.alternatives.map((a) => (
              <tr key={a.rank}><td className="td">{a.rank}</td><td className="td">{fmtKm(a.distance_m)}</td><td className="td">{a.max_road_risk.toFixed(0)}</td>
                <td className="td text-[12px] text-fg-muted">{a.node_path.map((n) => nodeLabel(snap.nodes, n)).join(' → ')}</td></tr>
            ))}</tbody></table>
        </>
      )}

      {detailed && r.candidates.length > 0 && (
        <>
          <h3 className="mb-1 mt-3 text-[12px] font-semibold text-fg-muted">Facilities considered</h3>
          <table className="w-full"><thead><tr><th className="th">Facility</th><th className="th">Free</th><th className="th">Distance</th><th className="th">Result</th></tr></thead>
            <tbody>{r.candidates.map((c) => (
              <tr key={c.id} className={c.id === r.facility?.id ? 'bg-cyanx/10' : ''}>
                <td className="td">{c.name}</td><td className="td">{fmtInt(c.available)}</td>
                <td className="td">{c.distance_m === null ? '—' : fmtKm(c.distance_m)}</td>
                <td className="td text-[12px] text-fg-muted">{c.id === r.facility?.id ? 'Chosen: lowest risk-weighted cost' : c.reason}</td>
              </tr>
            ))}</tbody></table>
        </>
      )}
    </Panel>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-ink-950 py-1.5">
      <div className="text-[11px] text-fg-muted">{label}</div>
      <div className="text-[17px] font-bold">{value}</div>
    </div>
  )
}
