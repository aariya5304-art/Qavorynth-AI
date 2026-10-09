import type { AppConfig, RouteRequest, ScenarioInfo, SimEvent, Snapshot } from '../types'

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '')

function sessionId(): string {
  try {
    let id = window.localStorage.getItem('qavorynth-session')
    if (!id) {
      id = (window.crypto?.randomUUID?.() ?? `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`)
      window.localStorage.setItem('qavorynth-session', id)
    }
    return id
  } catch {
    return 'anonymous'
  }
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId(), ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(`Cannot reach the API at ${BASE}. Is the backend running?`, 0)
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail)) detail = body.detail.map((d: { msg: string }) => d.msg).join('; ')
    } catch {
      /* keep default detail */
    }
    throw new ApiError(detail, res.status)
  }
  return (await res.json()) as T
}

const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  baseUrl: BASE,
  health: () => request<{ status: string; version: string; dataset: string }>('/api/health'),
  scenario: () => request<Snapshot>('/api/scenario'),
  scenarios: () => request<ScenarioInfo[]>('/api/scenarios'),
  activate: (id: string) => post<Snapshot>(`/api/scenarios/${encodeURIComponent(id)}/activate`),
  setConditions: (c: { rainfall_mm_hr?: number; rain_trend_mm_hr_per_h?: number; water_level_m?: number }) =>
    request<Snapshot>('/api/scenario/conditions', { method: 'PUT', body: JSON.stringify(c) }),
  blockRoad: (id: string) => post<Snapshot>(`/api/roads/${encodeURIComponent(id)}/block`),
  reopenRoad: (id: string) => post<Snapshot>(`/api/roads/${encodeURIComponent(id)}/reopen`),
  planRoute: (r: RouteRequest) => post<Snapshot>('/api/routes/evacuation', r),
  reset: () => post<Snapshot>('/api/simulation/reset'),
  events: (limit = 200) => request<SimEvent[]>(`/api/events?limit=${limit}`),
  config: () => request<AppConfig>('/api/config'),
}
