import { FormEvent, useEffect, useState } from 'react'
import { useSim } from '../store'
import MapView from '../components/MapView'
import Panel from '../components/Panel'
import RouteSummary from '../components/RouteSummary'
import type { FacilityKind, RouteMode } from '../types'

export default function EvacuationView() {
  const { snap, planRoute, busy } = useSim()
  const req = snap?.route_request
  const [origin, setOrigin] = useState(req?.origin_node_id ?? '')
  const [party, setParty] = useState(String(req?.party_size ?? 1))
  const [stepFree, setStepFree] = useState(req?.needs_step_free ?? false)
  const [mode, setMode] = useState<RouteMode>(req?.mode ?? 'balanced')
  const [kind, setKind] = useState<FacilityKind>(req?.destination_kind ?? 'shelter')

  useEffect(() => {
    if (!req) return
    setOrigin(req.origin_node_id); setParty(String(req.party_size)); setStepFree(req.needs_step_free)
    setMode(req.mode); setKind(req.destination_kind)
  }, [req?.origin_node_id, req?.party_size, req?.needs_step_free, req?.mode, req?.destination_kind])

  if (!snap) return null
  const partyNum = Number.parseInt(party, 10)
  const partyValid = Number.isInteger(partyNum) && partyNum >= 1 && partyNum <= 5000
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (partyValid) void planRoute({ origin_node_id: origin, party_size: partyNum, needs_step_free: stepFree, mode, destination_kind: kind })
  }
  const zoneName = (id: string) => snap.zones.find((z) => z.id === id)?.name ?? ''

  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <div className="space-y-3">
        <Panel title="Route request">
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <label className="label" htmlFor="origin">Evacuation origin (or click an intersection on the map)</label>
              <select id="origin" className="field" value={origin} onChange={(e) => setOrigin(e.target.value)}>
                {snap.nodes.map((n) => <option key={n.id} value={n.id}>Junction {n.label} · {zoneName(n.zone_id)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="party">Party size</label>
              <input id="party" className="field" inputMode="numeric" value={party} onChange={(e) => setParty(e.target.value)} aria-invalid={!partyValid} />
              {!partyValid && <span className="text-[11px] text-crit">Enter 1 to 5000.</span>}
            </div>
            <div>
              <label className="label" htmlFor="mode">Routing mode</label>
              <select id="mode" className="field" value={mode} onChange={(e) => setMode(e.target.value as RouteMode)}>
                <option value="fastest">Fastest (ignore risk)</option>
                <option value="balanced">Balanced</option>
                <option value="safest">Safest (avoid risk)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="kind">Destination</label>
              <select id="kind" className="field" value={kind} onChange={(e) => setKind(e.target.value as FacilityKind)}>
                <option value="shelter">Shelter</option>
                <option value="hospital">Hospital</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[13px] sm:col-span-2 lg:col-span-3">
              <input type="checkbox" checked={stepFree} onChange={(e) => setStepFree(e.target.checked)} className="accent-cyan-400" />
              Require step-free roads and a step-free destination
            </label>
            <div className="sm:col-span-2 lg:col-span-2 lg:text-right">
              <button className="btn btn-primary" type="submit" disabled={busy || !partyValid}>Recalculate route</button>
            </div>
          </form>
        </Panel>
        <MapView className="h-[540px]" />
      </div>
      <RouteSummary detailed />
    </div>
  )
}
