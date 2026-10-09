import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from './api/client'
import type { RouteRequest, Snapshot } from './types'

export interface Layers {
  zones: boolean
  roads: boolean
  intersections: boolean
  facilities: boolean
  route: boolean
  alternatives: boolean
  basemap: boolean
}

interface SimContext {
  snap: Snapshot | null
  loading: boolean
  error: string | null
  online: boolean
  busy: boolean
  notice: string | null
  selectedZoneId: string | null
  selectedRoadId: string | null
  horizon: number
  layers: Layers
  selectZone: (id: string | null) => void
  selectRoad: (id: string | null) => void
  setHorizon: (h: number) => void
  toggleLayer: (k: keyof Layers) => void
  dismissNotice: () => void
  retry: () => void
  activate: (id: string) => Promise<void>
  setConditions: (c: { rainfall_mm_hr?: number; rain_trend_mm_hr_per_h?: number; water_level_m?: number }) => Promise<void>
  blockRoad: (id: string) => Promise<void>
  reopenRoad: (id: string) => Promise<void>
  planRoute: (r: RouteRequest) => Promise<void>
  reset: () => Promise<void>
}

const Ctx = createContext<SimContext | null>(null)

export function useSim(): SimContext {
  const c = useContext(Ctx)
  if (!c) throw new Error('useSim must be used inside <SimProvider>')
  return c
}

export function SimProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedZoneId, selectZone] = useState<string | null>(null)
  const [selectedRoadId, selectRoad] = useState<string | null>(null)
  const [horizon, setHorizon] = useState(0)
  const [layers, setLayers] = useState<Layers>({
    zones: true, roads: true, intersections: true, facilities: true, route: true, alternatives: false, basemap: true,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSnap(await api.scenario())
      setOnline(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        await api.health()
        setOnline(true)
      } catch {
        setOnline(false)
      }
    }, 10000)
    return () => window.clearInterval(id)
  }, [])

  const run = useCallback(async (fn: () => Promise<Snapshot>) => {
    setBusy(true)
    try {
      setSnap(await fn())
      setOnline(true)
      setNotice(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) setOnline(false)
      setNotice(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }, [])

  const value = useMemo<SimContext>(() => ({
    snap, loading, error, online, busy, notice, selectedZoneId, selectedRoadId, horizon, layers,
    selectZone, selectRoad, setHorizon,
    toggleLayer: (k) => setLayers((l) => ({ ...l, [k]: !l[k] })),
    dismissNotice: () => setNotice(null),
    retry: () => { void load() },
    activate: (id) => run(() => api.activate(id)),
    setConditions: (c) => run(() => api.setConditions(c)),
    blockRoad: (id) => run(() => api.blockRoad(id)),
    reopenRoad: (id) => run(() => api.reopenRoad(id)),
    planRoute: (r) => run(() => api.planRoute(r)),
    reset: async () => { await run(() => api.reset()); selectZone(null); selectRoad(null); setHorizon(0) },
  }), [snap, loading, error, online, busy, notice, selectedZoneId, selectedRoadId, horizon, layers, run, load])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
