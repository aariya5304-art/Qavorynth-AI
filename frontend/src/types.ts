export type RiskClass = 'low' | 'medium' | 'high'
export type RoadStatus = 'open' | 'restricted' | 'unsafe' | 'blocked'
export type FacilityStatus = 'available' | 'near_full' | 'full' | 'flooded'
export type RouteMode = 'fastest' | 'balanced' | 'safest'
export type FacilityKind = 'shelter' | 'hospital'

export interface RiskComponent {
  input: number | null
  unit: string
  normalized: number
  weight: number
  contribution: number
  imputed: boolean
  rule: string
}
export interface Risk {
  score: number
  classification: RiskClass
  components: Record<string, RiskComponent>
  inputs: Record<string, number | null>
  warnings: string[]
  data_quality: 'complete' | 'degraded'
  explanation: string
}
export interface Zone {
  id: string
  name: string
  polygon: [number, number][]
  population: number
  area_km2: number
  mean_elevation_m: number
  river_proximity: number
  rain_factor: number
  anchor_node: string
  density_per_km2: number
  risk: Risk
}
export interface MapNode { id: string; label: string; lat: number; lng: number; elevation_m: number; zone_id: string }
export interface Road {
  id: string; name: string; a: string; b: string; distance_m: number; road_class: string
  elevation_m: number; raised: boolean; step_free: boolean; zone_id: string
  depth_m: number; risk_score: number; status: RoadStatus
}
export interface Facility {
  id: string; name: string; kind: FacilityKind; node_id: string; capacity: number; baseline_occupancy: number
  step_free: boolean; elevation_m: number; occupancy: number; flood_depth_m: number; operational: boolean
  available: number; occupancy_pct: number; status: FacilityStatus
}
export interface Metrics {
  total_zones: number; high_risk_zones: number; medium_risk_zones: number; low_risk_zones: number
  blocked_roads: number; unsafe_roads: number; restricted_roads: number
  available_shelter_capacity: number; operational_shelters: number; total_shelters: number
  population_in_high_risk: number; active_alerts: number
}
export interface Alert {
  id: string; severity: 'critical' | 'warning' | 'info'; kind: string; title: string; detail: string; ref: string | null
}
export interface Band { mid: number; lo: number; hi: number }
export interface ForecastPoint extends Band { h: number; classification: RiskClass }
export interface Hotspot {
  zone_id: string; name: string; current: number; at_3h: number; delta: number
  first_high_hour: number | null; possible_high_hour: number | null
}
export interface Forecast {
  horizons: number[]
  rain_history: number[]
  series: { h: number; label: string; rainfall_mm_hr: number; level: Band }[]
  zones: Record<string, ForecastPoint[]>
  hotspots: Hotspot[]
}
export interface RouteFacility { id: string; name: string; kind: string; node_id: string; capacity: number; occupancy: number; available: number }
export interface Candidate extends RouteFacility {
  eligible: boolean; reachable: boolean | null; cost: number | null; distance_m: number | null; reason: string
}
export interface Alternative { rank: number; node_path: string[]; road_path: string[]; cost: number; distance_m: number; max_road_risk: number }
export interface Route {
  status: 'ok' | 'no_route' | 'no_shelter'
  message: string
  origin_node_id: string
  mode: RouteMode
  party_size: number
  needs_step_free: boolean
  destination_kind: FacilityKind
  facility: RouteFacility | null
  node_path: string[]
  road_path: string[]
  total_distance_m: number
  total_cost: number
  est_travel_min: number
  max_road_risk: number
  excluded_road_count: number
  step_free_excluded_roads: number
  alternatives: Alternative[]
  candidates: Candidate[]
  warnings: string[]
}
export interface RouteRequest {
  origin_node_id: string; party_size: number; needs_step_free: boolean; mode: RouteMode; destination_kind: FacilityKind
}
export interface EventChanges {
  zones?: { zone: string; from: RiskClass; to: RiskClass; score_from: number; score_to: number }[]
  roads_closed?: [number, number]
  shelter_capacity?: [number, number]
  rerouted?: boolean
}
export interface SimEvent { id: number; timestamp: string; kind: string; title: string; detail: string; changes: EventChanges }
export interface ScenarioState {
  id: string; name: string; description: string; modified: boolean
  rainfall_mm_hr: number; rain_trend_mm_hr_per_h: number; water_level_m: number; blocked_roads: string[]
}
export interface Snapshot {
  city: { name: string; disclaimer: string; anchor: { lat: number; lng: number } }
  scenario: ScenarioState
  nodes: MapNode[]
  zones: Zone[]
  roads: Road[]
  facilities: Facility[]
  metrics: Metrics
  alerts: Alert[]
  forecast: Forecast
  route: Route
  route_request: RouteRequest
  baseline: { metrics: Omit<Metrics, 'active_alerts'>; route: Route; zones: Record<string, number> }
  recent_events: SimEvent[]
  charts: { risk_distribution: { name: string; value: number }[] }
}
export interface ScenarioInfo { id: string; name: string; description: string; rainfall_mm_hr: number; water_level_m: number; closed_roads: string[] }
export interface AppConfig {
  risk: {
    weights: Record<string, number>; rainfall_max_mm_hr: number; water_level_max_m: number; elevation_safe_m: number
    population_density_max: number; missing_impute: number; medium_threshold: number; high_threshold: number
  }
  flood: { unsafe_depth_m: number; restricted_depth_m: number; rule: string }
  routing: { algorithm: string; modes: Record<string, number>; excluded_statuses: string[]; cost: string; speed_kmh: Record<string, number>; travel_time_rule: string }
  forecast: {
    type: string; features: string[]; training_data: string; interval: string; assumptions: string[]
    validation: Record<string, { mae_m: number; rmse_m: number; r2: number }>
  }
  dataset: { name: string; disclaimer: string }
}
export type ViewId = 'overview' | 'map' | 'evacuation' | 'shelters' | 'simulator' | 'log' | 'method'
