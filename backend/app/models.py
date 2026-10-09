"""Pydantic request/response models for the REST API."""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    version: str
    dataset: str
    zones: int
    roads: int


class RiskRequest(BaseModel):
    """All inputs optional: missing values are imputed (and flagged) rather than rejected."""
    rainfall_mm_hr: Optional[float] = Field(None, ge=0, le=500, description="Rainfall intensity in mm/h")
    water_level_m: Optional[float] = Field(None, ge=0, le=30, description="River stage in metres above datum")
    elevation_m: Optional[float] = Field(None, ge=-50, le=9000, description="Zone mean elevation in metres")
    population_density_per_km2: Optional[float] = Field(None, ge=0, le=200000)
    river_proximity: Optional[float] = Field(1.0, ge=0, le=1, description="0 = far from river, 1 = adjacent")


class RiskComponent(BaseModel):
    input: Optional[float]
    unit: str
    normalized: float
    weight: float
    contribution: float
    imputed: bool
    rule: str


class RiskResponse(BaseModel):
    score: float = Field(ge=0, le=100)
    classification: Literal["low", "medium", "high"]
    components: Dict[str, RiskComponent]
    inputs: Dict[str, Optional[float]]
    warnings: List[str]
    data_quality: Literal["complete", "degraded"]
    explanation: str


class ConditionsUpdate(BaseModel):
    rainfall_mm_hr: Optional[float] = Field(None, ge=0, le=300)
    rain_trend_mm_hr_per_h: Optional[float] = Field(None, ge=-50, le=50)
    water_level_m: Optional[float] = Field(None, ge=0, le=15)


class RouteRequest(BaseModel):
    origin_node_id: str
    party_size: int = Field(1, ge=1, le=5000)
    needs_step_free: bool = False
    mode: Literal["fastest", "balanced", "safest"] = "balanced"
    destination_kind: Literal["shelter", "hospital"] = "shelter"


class RouteFacility(BaseModel):
    id: str
    name: str
    kind: str
    node_id: str
    capacity: int
    occupancy: int
    available: int


class RouteResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    status: Literal["ok", "no_route", "no_shelter"]
    message: str
    origin_node_id: str
    facility: Optional[RouteFacility]
    node_path: List[str]
    road_path: List[str]
    total_distance_m: float
    total_cost: float
    est_travel_min: float
    warnings: List[str]


class Snapshot(BaseModel):
    """Full application state. Nested collections are validated at the engine boundary."""
    model_config = ConfigDict(extra="allow")
    city: Dict[str, Any]
    scenario: Dict[str, Any]
    nodes: List[Dict[str, Any]]
    zones: List[Dict[str, Any]]
    roads: List[Dict[str, Any]]
    facilities: List[Dict[str, Any]]
    metrics: Dict[str, Any]
    alerts: List[Dict[str, Any]]
    forecast: Dict[str, Any]
    route: Dict[str, Any]
    baseline: Dict[str, Any]
    recent_events: List[Dict[str, Any]]


class EventModel(BaseModel):
    id: int
    timestamp: str
    kind: str
    title: str
    detail: str
    changes: Dict[str, Any]
