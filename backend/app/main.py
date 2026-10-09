"""Qavorynth AI REST API (FastAPI). Run: uvicorn app.main:app --reload

Each browser session (X-Session-Id header) gets its own isolated simulation so several people can use a
public demo at once without overwriting each other's scenarios. Sessions live in memory (LRU-capped).
"""
from __future__ import annotations

import os
import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import models as m
from .config import APP_VERSION, cors_origin_regex, cors_origins
from .engine.forecast import WaterLevelModel
from .engine.risk import compute_risk
from .simulation import NotFound, Simulation

app = FastAPI(
    title="Qavorynth AI API",
    version=APP_VERSION,
    description=("Urban flood risk scoring, short-horizon forecasting and dynamic evacuation routing over a "
                 "SYNTHETIC demonstration city. Not for real emergency decisions."),
)
app.add_middleware(CORSMiddleware, allow_origins=cors_origins(), allow_origin_regex=cors_origin_regex(),
                   allow_methods=["*"], allow_headers=["*"])

_MODEL = WaterLevelModel()                 # trained once, shared (read-only)
_TEMPLATE = Simulation(model=_MODEL)       # static dataset/config, never mutated
_SESSIONS: "OrderedDict[str, Simulation]" = OrderedDict()
_SESSIONS_LOCK = threading.Lock()
MAX_SESSIONS = int(os.getenv("MAX_SESSIONS", "200"))


def get_sim(x_session_id: Optional[str] = Header(default=None)) -> Simulation:
    sid = (x_session_id or "default")[:64]
    with _SESSIONS_LOCK:
        if sid in _SESSIONS:
            _SESSIONS.move_to_end(sid)
        else:
            _SESSIONS[sid] = Simulation(model=_MODEL)
            while len(_SESSIONS) > MAX_SESSIONS:
                _SESSIONS.popitem(last=False)
        return _SESSIONS[sid]


def _nf(e: NotFound) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Unknown id: {e.args[0]}")


@app.get("/api/health", response_model=m.HealthResponse, tags=["system"])
def health():
    return m.HealthResponse(version=APP_VERSION, dataset=_TEMPLATE.city["name"], zones=len(_TEMPLATE.zones),
                            roads=len(_TEMPLATE.roads))


@app.get("/api/config", tags=["system"], summary="Model, routing and dataset configuration")
def get_config() -> Dict[str, Any]:
    return _TEMPLATE.config()


@app.get("/api/scenario", response_model=m.Snapshot, tags=["scenario"], summary="Current scenario with all derived state")
def get_scenario(sim: Simulation = Depends(get_sim)):
    return sim.snapshot()


@app.get("/api/scenarios", tags=["scenario"], summary="Predefined reproducible scenarios")
def list_scenarios() -> List[Dict[str, Any]]:
    return [{"id": s["id"], "name": s["name"], "description": s["description"], "rainfall_mm_hr": s["rainfall_mm_hr"],
             "water_level_m": s["water_level_m"], "closed_roads": s["closed_roads"]}
            for s in _TEMPLATE.scenarios.values()]


@app.post("/api/scenarios/{scenario_id}/activate", response_model=m.Snapshot, tags=["scenario"])
def activate(scenario_id: str, sim: Simulation = Depends(get_sim)):
    try:
        return sim.activate_scenario(scenario_id)
    except NotFound as e:
        raise _nf(e)


@app.put("/api/scenario/conditions", response_model=m.Snapshot, tags=["scenario"],
         summary="Update rainfall, rainfall trend and/or water level")
def update_conditions(body: m.ConditionsUpdate, sim: Simulation = Depends(get_sim)):
    return sim.set_conditions(body.rainfall_mm_hr, body.rain_trend_mm_hr_per_h, body.water_level_m)


@app.get("/api/zones", tags=["data"])
def zones(sim: Simulation = Depends(get_sim)) -> List[Dict[str, Any]]:
    return sim.snapshot()["zones"]


@app.get("/api/roads", tags=["data"])
def roads(sim: Simulation = Depends(get_sim)) -> List[Dict[str, Any]]:
    return sim.snapshot()["roads"]


@app.get("/api/shelters", tags=["data"], summary="Shelters and hospitals with live status")
def shelters(sim: Simulation = Depends(get_sim)) -> List[Dict[str, Any]]:
    return sim.snapshot()["facilities"]


@app.post("/api/risk/calculate", response_model=m.RiskResponse, tags=["risk"],
          summary="Stateless risk calculation with full component breakdown")
def risk_calculate(body: m.RiskRequest):
    return compute_risk(body.rainfall_mm_hr, body.water_level_m, body.elevation_m, body.population_density_per_km2,
                        body.river_proximity)


@app.post("/api/roads/{road_id}/block", response_model=m.Snapshot, tags=["roads"])
def block_road(road_id: str, sim: Simulation = Depends(get_sim)):
    try:
        return sim.block_road(road_id)
    except NotFound as e:
        raise _nf(e)


@app.post("/api/roads/{road_id}/reopen", response_model=m.Snapshot, tags=["roads"],
          summary="Reopen a manually blocked road (flood-unsafe roads stay excluded)")
def reopen_road(road_id: str, sim: Simulation = Depends(get_sim)):
    try:
        return sim.reopen_road(road_id)
    except NotFound as e:
        raise _nf(e)


@app.post("/api/routes/evacuation", response_model=m.Snapshot, tags=["routing"],
          summary="Plan an evacuation route; becomes the active route and returns full state")
def plan_route(body: m.RouteRequest, sim: Simulation = Depends(get_sim)):
    try:
        return sim.plan_route(body.origin_node_id, body.party_size, body.needs_step_free, body.mode,
                              body.destination_kind)
    except NotFound as e:
        raise _nf(e)


@app.post("/api/simulation/reset", response_model=m.Snapshot, tags=["scenario"],
          summary="Restore the deterministic baseline and clear history")
def reset(sim: Simulation = Depends(get_sim)):
    return sim.reset()


@app.get("/api/events", response_model=List[m.EventModel], tags=["events"])
def events(limit: int = Query(100, ge=1, le=500), sim: Simulation = Depends(get_sim)):
    return sim.get_events(limit)
