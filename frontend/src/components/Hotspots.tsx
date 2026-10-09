import { useSim } from '../store'
import { signed } from '../lib/format'
import Panel, { Chip } from './Panel'

export default function Hotspots({ className = '' }: { className?: string }) {
  const { snap, selectZone } = useSim()
  if (!snap) return null
  return (
    <Panel title="Predicted hotspots (next 3 h)" className={className} bodyClass="overflow-auto p-0"
      right={<span className="text-[11px] text-fg-dim">synthetic-trained model</span>}>
      <table className="w-full">
        <thead><tr><th className="th">Zone</th><th className="th">Now</th><th className="th">+3 h</th><th className="th">Change</th><th className="th">High risk</th></tr></thead>
        <tbody>
          {snap.forecast.hotspots.map((h) => (
            <tr key={h.zone_id} className="border-t border-line hover:bg-ink-800">
              <td className="td"><button className="text-left font-semibold hover:text-cyanx" onClick={() => selectZone(h.zone_id)}>{h.name}</button></td>
              <td className="td">{h.current.toFixed(1)}</td>
              <td className="td font-semibold">{h.at_3h.toFixed(1)}</td>
              <td className="td">{signed(h.delta, 1)}</td>
              <td className="td">
                {h.first_high_hour === 0 ? <Chip tone="high">Now</Chip>
                  : h.first_high_hour !== null ? <Chip tone="high">By +{h.first_high_hour} h</Chip>
                  : h.possible_high_hour !== null ? <Chip tone="medium">Possible +{h.possible_high_hour} h</Chip>
                  : <Chip tone="muted">Not expected</Chip>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
