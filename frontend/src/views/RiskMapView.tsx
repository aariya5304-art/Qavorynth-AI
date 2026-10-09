import { useSim } from '../store'
import Hotspots from '../components/Hotspots'
import MapView from '../components/MapView'
import Panel, { Chip } from '../components/Panel'
import ZonePanel from '../components/ZonePanel'
import { fmtInt, riskLabel, signed } from '../lib/format'

export default function RiskMapView() {
  const { snap, selectedZoneId, selectZone, horizon } = useSim()
  if (!snap) return null
  return (
    <div className="grid gap-3 p-3 xl:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
      <div className="space-y-3">
        <MapView className="h-[600px]" />
        <Panel title="Zones" bodyClass="overflow-auto p-0">
          <table className="w-full">
            <thead><tr><th className="th">Zone</th><th className="th">Risk now</th><th className="th">Class</th><th className="th">vs baseline</th><th className="th">Population</th><th className="th">Elevation</th></tr></thead>
            <tbody>
              {snap.zones.map((z) => (
                <tr key={z.id} className={`border-t border-line ${z.id === selectedZoneId ? 'bg-cyanx/10' : 'hover:bg-ink-800'}`}>
                  <td className="td"><button className="font-semibold hover:text-cyanx" aria-pressed={z.id === selectedZoneId} onClick={() => selectZone(z.id)}>{z.name}</button></td>
                  <td className="td">{z.risk.score.toFixed(1)}</td>
                  <td className="td"><Chip tone={z.risk.classification}>{riskLabel[z.risk.classification]}</Chip></td>
                  <td className="td">{signed(z.risk.score - (snap.baseline.zones[z.id] ?? 0), 1)}</td>
                  <td className="td">{fmtInt(z.population)}</td>
                  <td className="td">{z.mean_elevation_m} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
      <div className="space-y-3">
        {horizon > 0 && <p className="border border-line bg-ink-900 p-2 text-[12px] text-fg-muted">The map shows modelled risk at +{horizon} h. The panel below lists every horizon for the selected zone.</p>}
        <ZonePanel />
        <Hotspots />
      </div>
    </div>
  )
}
