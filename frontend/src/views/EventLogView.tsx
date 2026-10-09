import { useEffect, useState } from 'react'
import { api } from '../api/client'
import { useSim } from '../store'
import Panel, { Chip, Empty } from '../components/Panel'
import { fmtTime } from '../lib/format'
import type { SimEvent } from '../types'

export default function EventLogView() {
  const { snap } = useSim()
  const [events, setEvents] = useState<SimEvent[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const latest = snap?.recent_events[0]?.id

  useEffect(() => {
    api.events().then((e) => { setEvents(e); setErr(null) }).catch((e: Error) => setErr(e.message))
  }, [latest])

  return (
    <div className="p-3">
      <Panel title="Event log" right={<span className="text-[12px] text-fg-muted">{events?.length ?? 0} events, newest first</span>} bodyClass="overflow-auto p-0">
        {err && <p className="p-3 text-[13px] text-crit" role="alert">{err}</p>}
        {events === null && !err && <Empty>Loading events…</Empty>}
        {events && events.length === 0 && <Empty>No events yet.</Empty>}
        {events && events.length > 0 && (
          <table className="w-full min-w-[720px]">
            <thead><tr><th className="th">Time</th><th className="th">Type</th><th className="th">Event</th><th className="th">Details and effects</th></tr></thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-t border-line align-top">
                  <td className="td whitespace-nowrap text-fg-muted">{fmtTime(e.timestamp)}</td>
                  <td className="td"><Chip tone={e.changes.rerouted ? 'medium' : 'muted'}>{e.kind}{e.changes.rerouted ? ' · rerouted' : ''}</Chip></td>
                  <td className="td font-semibold">{e.title}</td>
                  <td className="td text-[12.5px] text-fg-muted">{e.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  )
}
