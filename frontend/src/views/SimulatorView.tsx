import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/client'
import { useSim } from '../store'
import Panel, { Chip } from '../components/Panel'
import RouteSummary from '../components/RouteSummary'
import { fmtKm, riskLabel, roadStatusLabel, signed } from '../lib/format'
import type { ScenarioInfo } from '../types'

export default function SimulatorView() {
  const { snap, activate, setConditions, blockRoad, reopenRoad, reset, busy, selectedRoadId, selectRoad, planRoute } = useSim()
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const sc = snap?.scenario
  const [rain, setRain] = useState(0)
  const [trend, setTrend] = useState(0)
  const [level, setLevel] = useState(0)

  useEffect(() => { api.scenarios().then(setScenarios).catch((e: Error) => setLoadErr(e.message)) }, [])
  useEffect(() => {
    if (sc) { setRain(sc.rainfall_mm_hr); setTrend(sc.rain_trend_mm_hr_per_h); setLevel(sc.water_level_m) }
  }, [sc?.rainfall_mm_hr, sc?.rain_trend_mm_hr_per_h, sc?.water_level_m])

  const roads = useMemo(() => [...(snap?.roads ?? [])].sort((a, b) => a.id.localeCompare(b.id)), [snap?.roads])
  if (!snap || !sc) return null
  const dirty = rain !== sc.rainfall_mm_hr || trend !== sc.rain_trend_mm_hr_per_h || level !== sc.water_level_m
  const road = roads.find((r) => r.id === selectedRoadId) ?? null
  const m = snap.metrics
  const b = snap.baseline.metrics
  const rows: [string, number, number][] = [
    ['High-risk zones', b.high_risk_zones, m.high_risk_zones],
    ['Medium-risk zones', b.medium_risk_zones, m.medium_risk_zones],
    ['Blocked roads', b.blocked_roads, m.blocked_roads],
    ['Flood-unsafe roads', b.unsafe_roads, m.unsafe_roads],
    ['Operating shelters', b.operational_shelters, m.operational_shelters],
    ['Free shelter capacity', b.available_shelter_capacity, m.available_shelter_capacity],
    ['Residents in high-risk zones', b.population_in_high_risk, m.population_in_high_risk],
  ]

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(340px,1fr)_minmax(0,1.4fr)]">
      <div className="space-y-3">
        <Panel title="Scenarios" right={<Chip tone="muted">Active: {sc.name}</Chip>}>
          {loadErr && <p className="mb-2 text-[12px] text-crit" role="alert">{loadErr}</p>}
          <ul className="space-y-2">
            {scenarios.map((s) => (
              <li key={s.id} className="border border-line bg-ink-950 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold">{s.name}</span>
                  <button className={`btn ${sc.id === s.id && !sc.modified ? '' : 'btn-primary'}`} disabled={busy} onClick={() => void activate(s.id)}>
                    {sc.id === s.id && !sc.modified ? 'Re-run' : 'Activate'}
                  </button>
                </div>
                <p className="text-[12px] text-fg-muted">{s.description}</p>
                <p className="text-[11.5px] text-fg-dim">Rain {s.rainfall_mm_hr} mm/h · water {s.water_level_m} m{s.closed_roads.length ? ` · closed: ${s.closed_roads.join(', ')}` : ''}</p>
              </li>
            ))}
          </ul>
          <button className="btn mt-2" disabled={busy} onClick={() => void reset()}>Reset to baseline</button>
        </Panel>

        <Panel title="Conditions">
          <Slider id="rain" label="Rainfall intensity" unit="mm/h" min={0} max={150} step={1} value={rain} onChange={setRain} />
          <Slider id="trend" label="Rainfall trend (per hour)" unit="mm/h" min={-20} max={20} step={1} value={trend} onChange={setTrend} />
          <Slider id="level" label="River water level" unit="m" min={0} max={12} step={0.1} value={level} onChange={setLevel} />
          <button className="btn btn-primary mt-1" disabled={busy || !dirty} onClick={() => void setConditions({ rainfall_mm_hr: rain, rain_trend_mm_hr_per_h: trend, water_level_m: level })}>
            Apply conditions
          </button>
        </Panel>

        <Panel title="Road control">
          <label className="label" htmlFor="road">Road segment (or click a road on any map)</label>
          <select id="road" className="field" value={selectedRoadId ?? ''} onChange={(e) => selectRoad(e.target.value || null)}>
            <option value="">Select a road…</option>
            {roads.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name} · {roadStatusLabel[r.status]}</option>)}
          </select>
          {road && (
            <div className="mt-2 text-[12.5px] text-fg-muted">
              <p>{road.name} · {fmtKm(road.distance_m)} · {road.road_class} · elevation {road.elevation_m} m · flood depth {road.depth_m.toFixed(2)} m · zone risk {road.risk_score.toFixed(1)}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn btn-danger" disabled={busy || road.status === 'blocked'} onClick={() => void blockRoad(road.id)}>Block road</button>
                <button className="btn" disabled={busy || !sc.blocked_roads.includes(road.id)} onClick={() => void reopenRoad(road.id)}>Reopen road</button>
              </div>
              {road.status === 'unsafe' && <p className="mt-1 text-warn">Closed by flood depth: it cannot be reopened manually and stays excluded from routing.</p>}
            </div>
          )}
        </Panel>

        <Panel title="Evacuation origin">
          <label className="label" htmlFor="sim-origin">Origin intersection</label>
          <select id="sim-origin" className="field" value={snap.route_request.origin_node_id}
            onChange={(e) => void planRoute({ ...snap.route_request, origin_node_id: e.target.value })}>
            {snap.nodes.map((n) => <option key={n.id} value={n.id}>Junction {n.label}</option>)}
          </select>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel title="Before and after (baseline vs current)" bodyClass="overflow-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">Metric</th><th className="th">Baseline</th><th className="th">Current</th><th className="th">Change</th></tr></thead>
            <tbody>{rows.map(([label, bv, cv]) => (
              <tr key={label} className="border-t border-line"><td className="td">{label}</td><td className="td">{bv.toLocaleString()}</td><td className="td font-semibold">{cv.toLocaleString()}</td><td className="td">{signed(cv - bv)}</td></tr>
            ))}</tbody>
          </table>
          <table className="w-full border-t border-line">
            <thead><tr><th className="th">Zone</th><th className="th">Baseline score</th><th className="th">Current score</th><th className="th">Change</th><th className="th">Class</th></tr></thead>
            <tbody>{snap.zones.map((z) => {
              const bs = snap.baseline.zones[z.id] ?? 0
              return (
                <tr key={z.id} className="border-t border-line"><td className="td">{z.name}</td><td className="td">{bs.toFixed(1)}</td><td className="td font-semibold">{z.risk.score.toFixed(1)}</td>
                  <td className="td">{signed(z.risk.score - bs, 1)}</td><td className="td"><Chip tone={z.risk.classification}>{riskLabel[z.risk.classification]}</Chip></td></tr>
              )
            })}</tbody>
          </table>
        </Panel>
        <RouteSummary detailed />
      </div>
    </div>
  )
}

function Slider({ id, label, unit, min, max, step, value, onChange }: {
  id: string; label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between"><label className="label" htmlFor={id}>{label}</label><output htmlFor={id} className="text-[13px] font-semibold">{value} {unit}</output></div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-cyan-400" />
    </div>
  )
}
