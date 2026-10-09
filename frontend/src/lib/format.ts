import type { Facility, FacilityStatus, MapNode, RiskClass, RoadStatus } from '../types'

export const riskColor: Record<RiskClass, string> = { low: '#46c48a', medium: '#f2b84b', high: '#ef5b5b' }
export const riskLabel: Record<RiskClass, string> = { low: 'Low', medium: 'Medium', high: 'High' }
export const roadStatusLabel: Record<RoadStatus, string> = {
  open: 'Open', restricted: 'Restricted', unsafe: 'Unsafe (flood)', blocked: 'Blocked',
}
export const facilityStatusLabel: Record<FacilityStatus, string> = {
  available: 'Available', near_full: 'Near full', full: 'Full', flooded: 'Flooded',
}

export const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US')
export const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`)
export const fmtMin = (m: number) => `${Math.max(1, Math.round(m))} min`
export const fmtTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
export const signed = (n: number, digits = 0) => `${n > 0 ? '+' : ''}${n.toFixed(digits)}`
export const nodeLabel = (nodes: MapNode[], id: string) => nodes.find((n) => n.id === id)?.label ?? id
export const facilityName = (fs: Facility[], id: string) => fs.find((f) => f.id === id)?.name ?? id
