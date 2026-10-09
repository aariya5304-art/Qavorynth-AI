import { useMemo } from 'react'
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip } from 'react-leaflet'
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSim, Layers } from '../store'
import { facilityStatusLabel, fmtKm, riskColor, riskLabel, roadStatusLabel } from '../lib/format'
import type { RoadStatus } from '../types'
import ForecastScrubber from './ForecastScrubber'

const ROAD_STYLE: Record<RoadStatus, { color: string; weight: number; dashArray?: string; opacity: number }> = {
  open: { color: '#5b7db3', weight: 3, opacity: 0.85 },
  restricted: { color: '#f2b84b', weight: 4, opacity: 0.95 },
  unsafe: { color: '#ef5b5b', weight: 4, dashArray: '7 6', opacity: 0.95 },
  blocked: { color: '#ef5b5b', weight: 6, dashArray: '1 8', opacity: 1 },
}

const LAYER_LABELS: [keyof Layers, string][] = [
  ['zones', 'Risk zones'], ['roads', 'Road network'], ['intersections', 'Intersections'],
  ['facilities', 'Shelters & hospitals'], ['route', 'Recommended route'], ['alternatives', 'Alternative routes'],
  ['basemap', 'OpenStreetMap backdrop'],
]

export default function MapView({ className = '', interactiveNodes = true }: { className?: string; interactiveNodes?: boolean }) {
  const { snap, horizon, layers, toggleLayer, selectedZoneId, selectZone, selectedRoadId, selectRoad, planRoute } = useSim()

  const nodeById = useMemo(() => new Map((snap?.nodes ?? []).map((n) => [n.id, n])), [snap?.nodes])
  const bounds = useMemo<LatLngBoundsExpression>(() => {
    const ns = snap?.nodes ?? []
    const lats = ns.map((n) => n.lat)
    const lngs = ns.map((n) => n.lng)
    return [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]
  }, [snap?.nodes])

  if (!snap) return null
  const pos = (id: string): LatLngExpression => {
    const n = nodeById.get(id)
    return n ? [n.lat, n.lng] : [0, 0]
  }
  const route = snap.route
  const req = snap.route_request
  const setOrigin = (id: string) => void planRoute({ ...req, origin_node_id: id })

  return (
    <div className={`panel flex min-h-0 flex-col ${className}`}>
      <div role="region" aria-label="Interactive risk map" className={`relative min-h-[340px] flex-1 ${layers.basemap ? 'dim-tiles' : 'no-tiles'}`}>
        <MapContainer bounds={bounds} boundsOptions={{ padding: [28, 28] }} scrollWheelZoom className="absolute inset-0">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {layers.zones && snap.zones.map((z) => {
            const fp = snap.forecast.zones[z.id]?.[horizon]
            const cls = horizon === 0 || !fp ? z.risk.classification : fp.classification
            const score = horizon === 0 || !fp ? z.risk.score : fp.mid
            const selected = z.id === selectedZoneId
            return (
              <Polygon key={z.id} positions={z.polygon as LatLngExpression[]}
                pathOptions={{ color: selected ? '#3fd0e8' : riskColor[cls], weight: selected ? 3 : 1, fillColor: riskColor[cls], fillOpacity: 0.2 }}
                eventHandlers={{ click: () => selectZone(z.id) }}>
                <Tooltip sticky>{z.name}: {riskLabel[cls]} ({score.toFixed(1)}){horizon > 0 ? ` at +${horizon} h` : ''}</Tooltip>
              </Polygon>
            )
          })}

          {layers.roads && snap.roads.map((r) => {
            const s = ROAD_STYLE[r.status]
            const sel = r.id === selectedRoadId
            return (
              <Polyline key={r.id} positions={[pos(r.a), pos(r.b)]}
                pathOptions={{ ...s, color: sel ? '#3fd0e8' : s.color, weight: sel ? s.weight + 2 : s.weight }}
                eventHandlers={{ click: () => selectRoad(r.id) }}>
                <Tooltip sticky>{r.name} · {roadStatusLabel[r.status]} · {fmtKm(r.distance_m)}{r.depth_m > 0 ? ` · depth ${r.depth_m.toFixed(2)} m` : ''}</Tooltip>
              </Polyline>
            )
          })}

          {layers.route && layers.alternatives && route.status === 'ok' && route.alternatives.map((a) => (
            <Polyline key={`alt-${a.rank}-${a.road_path.join('')}`} positions={a.node_path.map(pos)}
              pathOptions={{ color: '#8fb4ff', weight: 4, dashArray: '3 8', opacity: 0.8 }}>
              <Tooltip sticky>Alternative {a.rank}: {fmtKm(a.distance_m)}</Tooltip>
            </Polyline>
          ))}

          {layers.route && route.status === 'ok' && (
            <Polyline key={route.road_path.join('-') || route.origin_node_id} positions={route.node_path.map(pos)}
              pathOptions={{ color: '#3fd0e8', weight: 7, opacity: 0.95, lineCap: 'round', className: 'route-in' }}>
              <Tooltip sticky>Recommended route to {route.facility?.name} · {fmtKm(route.total_distance_m)}</Tooltip>
            </Polyline>
          )}

          {layers.intersections && snap.nodes.map((n) => (
            <CircleMarker key={n.id} center={[n.lat, n.lng]} radius={n.id === route.origin_node_id ? 8 : 4}
              pathOptions={{ color: n.id === route.origin_node_id ? '#3fd0e8' : '#2c4268', weight: 2,
                fillColor: n.id === route.origin_node_id ? '#3fd0e8' : '#0b1322', fillOpacity: 1 }}
              eventHandlers={interactiveNodes ? { click: () => setOrigin(n.id) } : undefined}>
              <Tooltip>{n.id === route.origin_node_id ? 'Evacuation origin · ' : interactiveNodes ? 'Click to set as origin · ' : ''}Junction {n.label} · {n.elevation_m} m</Tooltip>
            </CircleMarker>
          ))}

          {layers.facilities && snap.facilities.map((f) => {
            const node = nodeById.get(f.node_id)
            if (!node) return null
            const bad = f.status === 'flooded'
            const chosen = route.facility?.id === f.id && route.status === 'ok'
            return (
              <CircleMarker key={f.id} center={[node.lat, node.lng]} radius={chosen ? 12 : 9}
                pathOptions={{ color: bad ? '#ef5b5b' : f.kind === 'hospital' ? '#ffffff' : '#3fd0e8', weight: chosen ? 4 : 2,
                  fillColor: bad ? '#3a1519' : '#0b1322', fillOpacity: 1, dashArray: f.kind === 'hospital' ? '3 2' : undefined }}>
                <Tooltip>
                  {f.kind === 'hospital' ? 'Hospital' : 'Shelter'}: {f.name} · {facilityStatusLabel[f.status]} · {f.available} free of {f.capacity}
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>

        <div className="pointer-events-none absolute left-2 top-2 z-[1000] border border-warn/50 bg-ink-950/90 px-2 py-1 text-[11.5px] text-warn">
          Synthetic network · not real roads or facilities
        </div>

        <fieldset className="absolute right-2 top-2 z-[1000] max-h-[70%] overflow-auto border border-line bg-ink-950/90 px-2.5 py-2 text-[12px]">
          <legend className="sr-only">Map layers</legend>
          <div className="mb-1 font-semibold text-fg-muted">Layers</div>
          {LAYER_LABELS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5 py-0.5">
              <input type="checkbox" checked={layers[k]} onChange={() => toggleLayer(k)} className="accent-cyan-400" />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="absolute bottom-6 left-2 z-[1000] border border-line bg-ink-950/90 px-2.5 py-2 text-[11.5px]" aria-label="Legend">
          <div className="mb-1 font-semibold text-fg-muted">Zone risk</div>
          {(['low', 'medium', 'high'] as const).map((c) => (
            <div key={c} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5" style={{ background: riskColor[c] }} />{riskLabel[c]}</div>
          ))}
          <div className="mb-1 mt-1.5 font-semibold text-fg-muted">Roads</div>
          <LegendLine color="#5b7db3" label="Open" />
          <LegendLine color="#f2b84b" label="Restricted" />
          <LegendLine color="#ef5b5b" label="Unsafe (dashed)" dash="5 3" />
          <LegendLine color="#ef5b5b" label="Blocked (dotted)" dash="1 3" thick />
          <LegendLine color="#3fd0e8" label="Recommended route" thick />
        </div>
      </div>
      <ForecastScrubber />
    </div>
  )
}

function LegendLine({ color, label, dash, thick }: { color: string; label: string; dash?: string; thick?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="22" height="8" aria-hidden="true">
        <line x1="1" y1="4" x2="21" y2="4" stroke={color} strokeWidth={thick ? 4 : 2.5} strokeDasharray={dash} />
      </svg>
      {label}
    </div>
  )
}
