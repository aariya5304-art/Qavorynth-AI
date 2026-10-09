import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useSim } from '../store'
import Panel, { Empty } from '../components/Panel'
import type { AppConfig } from '../types'

export default function MethodologyView() {
  const { snap } = useSim()
  const [cfg, setCfg] = useState<AppConfig | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { api.config().then(setCfg).catch((e: Error) => setErr(e.message)) }, [])
  if (err) return <p className="p-4 text-crit" role="alert">{err}</p>
  if (!cfg) return <Empty>Loading methodology from the API…</Empty>
  const rules = snap?.zones[0]?.risk.components ?? {}
  const NAMES: Record<string, string> = { rainfall: 'Rainfall', water_level: 'Water level', low_elevation: 'Low elevation', population_exposure: 'Population exposure' }

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-2">
      <Panel title="Risk model">
        <p className="mb-2 text-[13px] text-fg-muted">Each input is normalised to 0–100 with its own unit-aware rule, weighted, summed, clamped to 0–100 and classified. Missing or invalid inputs are imputed at {cfg.risk.missing_impute}/100 and flagged as low confidence.</p>
        <table className="w-full"><thead><tr><th className="th">Component</th><th className="th">Weight</th><th className="th">Normalisation</th></tr></thead>
          <tbody>{Object.entries(cfg.risk.weights).map(([k, w]) => (
            <tr key={k} className="border-t border-line"><td className="td">{NAMES[k] ?? k}</td><td className="td">{w.toFixed(2)}</td><td className="td text-[12px] text-fg-muted">{rules[k]?.rule ?? '—'}</td></tr>
          ))}</tbody></table>
        <p className="mt-2 text-[13px]">Classes: low below {cfg.risk.medium_threshold}, medium below {cfg.risk.high_threshold}, high at {cfg.risk.high_threshold} and above. <span className="text-warn">Prototype thresholds, not validated flood-warning levels.</span></p>
      </Panel>

      <Panel title="Road states and routing">
        <p className="text-[13px] text-fg-muted">{cfg.flood.rule}</p>
        <p className="mt-2 text-[13px]"><b>Algorithm:</b> {cfg.routing.algorithm}.</p>
        <p className="mt-1 text-[13px]"><b>Edge cost:</b> <code className="text-cyanx">{cfg.routing.cost}</code></p>
        <p className="mt-1 text-[13px]"><b>Modes (λ):</b> {Object.entries(cfg.routing.modes).map(([k, v]) => `${k} = ${v}`).join(', ')}</p>
        <p className="mt-1 text-[13px]"><b>Excluded before search:</b> roads with status {cfg.routing.excluded_statuses.join(' and ')}. A route can never contain them. If nothing is reachable the API returns an explicit no-route result.</p>
        <p className="mt-1 text-[13px]"><b>Shelter choice:</b> lowest risk-weighted cost among operational facilities with enough free capacity and (if required) step-free access.</p>
        <p className="mt-1 text-[13px]"><b>Travel time:</b> {cfg.routing.travel_time_rule} Class speeds: {Object.entries(cfg.routing.speed_kmh).map(([k, v]) => `${k} ${v} km/h`).join(', ')}.</p>
      </Panel>

      <Panel title="Short-horizon forecast model">
        <p className="text-[13px]"><b>Model:</b> {cfg.forecast.type}.</p>
        <p className="mt-1 text-[13px]"><b>Features:</b> {cfg.forecast.features.join(', ')}.</p>
        <p className="mt-1 text-[13px]"><b>Training data:</b> {cfg.forecast.training_data}.</p>
        <table className="mt-2 w-full"><thead><tr><th className="th">Horizon</th><th className="th">MAE (m)</th><th className="th">RMSE (m)</th><th className="th">R²</th></tr></thead>
          <tbody>{Object.entries(cfg.forecast.validation).map(([h, v]) => (
            <tr key={h} className="border-t border-line"><td className="td">{h}</td><td className="td">{v.mae_m}</td><td className="td">{v.rmse_m}</td><td className="td">{v.r2}</td></tr>
          ))}</tbody></table>
        <p className="mt-2 text-[13px]">{cfg.forecast.interval}.</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-[12.5px] text-warn">{cfg.forecast.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </Panel>

      <Panel title="Dataset and limitations">
        <p className="text-[13px]"><b>{cfg.dataset.name}.</b> {cfg.dataset.disclaimer}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-fg-muted">
          <li>No live sensors, official warnings or real incidents are used. Every value comes from the synthetic dataset or from calculations on it.</li>
          <li>The OpenStreetMap backdrop is decoration only. The road network drawn on it is fictional.</li>
          <li>The accuracy figures above describe the model on synthetic sequences, not real-world performance.</li>
          <li>Do not use this prototype for real evacuation or safety decisions.</li>
        </ul>
      </Panel>
    </div>
  )
}
