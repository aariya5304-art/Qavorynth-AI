"""Stateful simulation: scenario state -> risk -> road states -> routing -> alerts -> events."""
from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import DATA_DIR
from .engine import routing
from .engine.alerts import derive_alerts
from .engine.forecast import HORIZONS, WaterLevelModel, rain_history
from .engine.risk import DEFAULT_CONFIG, RiskConfig, classify, compute_risk

DEFAULT_ROUTE = {"origin_node_id": "N41", "party_size": 1, "needs_step_free": False, "mode": "balanced",
                 "destination_kind": "shelter"}


class NotFound(KeyError):
    pass


class Simulation:
    def __init__(self, data_dir=DATA_DIR, model: Optional[WaterLevelModel] = None):
        self.city = json.loads((data_dir / "city.json").read_text())
        sc = json.loads((data_dir / "scenarios.json").read_text())
        self.scenarios = {s["id"]: s for s in sc["scenarios"]}
        self.unsafe_depth = sc["unsafe_depth_m"]
        self.restricted_depth = sc["restricted_depth_m"]
        self.cfg: RiskConfig = DEFAULT_CONFIG
        self.nodes = {n["id"]: n for n in self.city["nodes"]}
        self.roads = {r["id"]: r for r in self.city["roads"]}
        self.zones = {z["id"]: z for z in self.city["zones"]}
        self.facilities = {f["id"]: f for f in self.city["facilities"]}
        self.model = model or WaterLevelModel()
        self._lock = threading.RLock()
        self._seq = 0
        self.events: List[Dict[str, Any]] = []
        self.state: Dict[str, Any] = {}
        self._load_scenario("baseline")
        self._log("system", "Simulation initialised", f"Baseline loaded for {self.city['name']} (synthetic dataset).")

    # ------------------------------------------------------------------ state
    def _load_scenario(self, scenario_id: str) -> None:
        s = self.scenarios[scenario_id]
        route = dict(DEFAULT_ROUTE)
        route["origin_node_id"] = s.get("demo_origin", route["origin_node_id"])
        if self.state.get("route"):
            route.update({k: v for k, v in self.state["route"].items() if k != "origin_node_id"})
        self.state = {"scenario_id": s["id"], "name": s["name"], "description": s["description"], "modified": False,
                      "rainfall_mm_hr": float(s["rainfall_mm_hr"]), "rain_trend": float(s["rain_trend_mm_hr_per_h"]),
                      "water_level_m": float(s["water_level_m"]), "blocked": set(s["closed_roads"]),
                      "occupancy": dict(s["occupancy"]), "route": route}

    def _baseline_state(self) -> Dict[str, Any]:
        s = self.scenarios["baseline"]
        return {"rainfall_mm_hr": float(s["rainfall_mm_hr"]), "rain_trend": float(s["rain_trend_mm_hr_per_h"]),
                "water_level_m": float(s["water_level_m"]), "blocked": set(), "occupancy": {},
                "route": self.state["route"]}

    # ------------------------------------------------------------- evaluation
    def _evaluate(self, st: Dict[str, Any]) -> Dict[str, Any]:
        level, rain = st["water_level_m"], st["rainfall_mm_hr"]
        zones = []
        for z in self.city["zones"]:
            risk = compute_risk(rain * z["rain_factor"], level, z["mean_elevation_m"],
                                z["population"] / z["area_km2"], z["river_proximity"], self.cfg)
            zones.append({**z, "density_per_km2": round(z["population"] / z["area_km2"], 1), "risk": risk})
        zscore = {z["id"]: z["risk"]["score"] for z in zones}
        roads = []
        for r in self.city["roads"]:
            depth = max(0.0, level - r["elevation_m"])
            if r["id"] in st["blocked"]:
                status = "blocked"
            elif depth >= self.unsafe_depth:
                status = "unsafe"
            elif depth >= self.restricted_depth or zscore[r["zone_id"]] >= self.cfg.high_threshold:
                status = "restricted"
            else:
                status = "open"
            roads.append({**r, "depth_m": round(depth, 2), "risk_score": zscore[r["zone_id"]], "status": status})
        facs = []
        for f in self.city["facilities"]:
            depth = max(0.0, level - f["elevation_m"])
            occ = int(st["occupancy"].get(f["id"], f["baseline_occupancy"]))
            operational = depth < self.unsafe_depth
            available = max(0, f["capacity"] - occ) if operational else 0
            pct = occ / f["capacity"] * 100
            status = "flooded" if not operational else "full" if available == 0 else "near_full" if pct >= 85 else "available"
            facs.append({**f, "occupancy": occ, "flood_depth_m": round(depth, 2), "operational": operational,
                         "available": available, "occupancy_pct": round(pct, 1), "status": status})
        shelters = [f for f in facs if f["kind"] == "shelter"]
        classes = [z["risk"]["classification"] for z in zones]
        metrics = {
            "total_zones": len(zones), "high_risk_zones": classes.count("high"),
            "medium_risk_zones": classes.count("medium"), "low_risk_zones": classes.count("low"),
            "blocked_roads": sum(r["status"] == "blocked" for r in roads),
            "unsafe_roads": sum(r["status"] == "unsafe" for r in roads),
            "restricted_roads": sum(r["status"] == "restricted" for r in roads),
            "available_shelter_capacity": sum(f["available"] for f in shelters),
            "operational_shelters": sum(f["operational"] for f in shelters), "total_shelters": len(shelters),
            "population_in_high_risk": sum(z["population"] for z in zones if z["risk"]["classification"] == "high"),
        }
        return {"zones": zones, "roads": roads, "facilities": facs, "metrics": metrics}

    def _forecast(self, st: Dict[str, Any]) -> Dict[str, Any]:
        rain, slope, level = st["rainfall_mm_hr"], st["rain_trend"], st["water_level_m"]
        hist = rain_history(rain, slope)
        series = [{"h": 0, "label": "Now", "rainfall_mm_hr": round(rain, 1),
                   "level": {"mid": level, "lo": level, "hi": level}}]
        levels = {0: {"mid": level, "lo": level, "hi": level}}
        for h in HORIZONS:
            p = self.model.predict(hist, level, h)
            levels[h] = p
            series.append({"h": h, "label": f"+{h}h", "rainfall_mm_hr": round(max(0.0, rain + slope * h), 1),
                           "level": {k: round(v, 2) for k, v in p.items()}})
        per_zone: Dict[str, List[Dict[str, Any]]] = {}
        for z in self.city["zones"]:
            dens = z["population"] / z["area_km2"]
            rows = []
            for h in (0,) + HORIZONS:
                r_h = max(0.0, rain + slope * h) * z["rain_factor"]
                vals = {k: compute_risk(r_h, levels[h][k], z["mean_elevation_m"], dens, z["river_proximity"], self.cfg)["score"]
                        for k in ("lo", "mid", "hi")}
                rows.append({"h": h, **vals, "classification": classify(vals["mid"], self.cfg)})
            per_zone[z["id"]] = rows
        hotspots = []
        for z in self.city["zones"]:
            rows = per_zone[z["id"]]
            first = next((r["h"] for r in rows if r["mid"] >= self.cfg.high_threshold), None)
            possible = next((r["h"] for r in rows if r["hi"] >= self.cfg.high_threshold), None)
            hotspots.append({"zone_id": z["id"], "name": z["name"], "current": rows[0]["mid"], "at_3h": rows[-1]["mid"],
                             "delta": round(rows[-1]["mid"] - rows[0]["mid"], 1), "first_high_hour": first,
                             "possible_high_hour": possible})
        hotspots.sort(key=lambda h: (-h["at_3h"], h["zone_id"]))
        return {"horizons": [0, *HORIZONS], "rain_history": [round(v, 1) for v in hist], "series": series,
                "zones": per_zone, "hotspots": hotspots}

    def _route(self, ev: Dict[str, Any], req: Dict[str, Any]) -> Dict[str, Any]:
        return routing.plan_evacuation(roads=ev["roads"], facilities=ev["facilities"], node_ids=set(self.nodes),
                                       unsafe_depth_m=self.unsafe_depth, origin_node=req["origin_node_id"],
                                       party_size=req["party_size"], needs_step_free=req["needs_step_free"],
                                       mode=req["mode"], destination_kind=req["destination_kind"])

    def _view(self, st: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        st = st or self.state
        ev = self._evaluate(st)
        fc = self._forecast(st)
        alerts = derive_alerts(ev["zones"], ev["roads"], ev["facilities"], fc)
        ev["metrics"]["active_alerts"] = sum(a["severity"] != "info" for a in alerts)
        return {**ev, "forecast": fc, "alerts": alerts, "route": self._route(ev, st["route"])}

    # --------------------------------------------------------------- snapshot
    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            v = self._view()
            bst = self._baseline_state()
            bev = self._evaluate(bst)
            broute = self._route(bev, bst["route"])
            st = self.state
            return {
                "city": {"name": self.city["name"], "disclaimer": self.city["disclaimer"], "anchor": self.city["anchor"]},
                "scenario": {"id": st["scenario_id"], "name": st["name"] + (" (modified)" if st["modified"] else ""),
                             "description": st["description"], "modified": st["modified"],
                             "rainfall_mm_hr": st["rainfall_mm_hr"], "rain_trend_mm_hr_per_h": st["rain_trend"],
                             "water_level_m": st["water_level_m"], "blocked_roads": sorted(st["blocked"])},
                "nodes": list(self.nodes.values()), "zones": v["zones"], "roads": v["roads"],
                "facilities": v["facilities"], "metrics": v["metrics"], "alerts": v["alerts"],
                "forecast": v["forecast"], "route": v["route"], "route_request": dict(st["route"]),
                "baseline": {"metrics": bev["metrics"], "route": broute,
                             "zones": {z["id"]: z["risk"]["score"] for z in bev["zones"]}},
                "recent_events": list(reversed(self.events[-8:])),
                "charts": {"risk_distribution": [
                    {"name": "Low", "value": v["metrics"]["low_risk_zones"]},
                    {"name": "Medium", "value": v["metrics"]["medium_risk_zones"]},
                    {"name": "High", "value": v["metrics"]["high_risk_zones"]}]},
            }

    # ------------------------------------------------------------- mutations
    @staticmethod
    def _route_brief(r: Dict[str, Any]) -> Dict[str, Any]:
        return {"status": r["status"], "facility": r["facility"]["name"] if r["facility"] else None,
                "facility_id": r["facility"]["id"] if r["facility"] else None,
                "distance_m": r["total_distance_m"], "roads": list(r["road_path"])}

    def _log(self, kind: str, title: str, detail: str, before: Optional[Dict] = None, after: Optional[Dict] = None) -> None:
        changes: Dict[str, Any] = {}
        if before and after:
            zc = []
            for b, a in zip(before["zones"], after["zones"]):
                if b["risk"]["classification"] != a["risk"]["classification"]:
                    zc.append({"zone": a["name"], "from": b["risk"]["classification"], "to": a["risk"]["classification"],
                               "score_from": b["risk"]["score"], "score_to": a["risk"]["score"]})
            rb, ra = self._route_brief(before["route"]), self._route_brief(after["route"])
            changes = {"zones": zc,
                       "roads_closed": [before["metrics"]["blocked_roads"] + before["metrics"]["unsafe_roads"],
                                        after["metrics"]["blocked_roads"] + after["metrics"]["unsafe_roads"]],
                       "shelter_capacity": [before["metrics"]["available_shelter_capacity"],
                                            after["metrics"]["available_shelter_capacity"]],
                       "route_before": rb, "route_after": ra, "rerouted": rb["roads"] != ra["roads"]}
            if changes["rerouted"]:
                detail += (f" Route changed: {rb['facility'] or rb['status']} ({rb['distance_m']:.0f} m) -> "
                           f"{ra['facility'] or ra['status']} ({ra['distance_m']:.0f} m).")
            if zc:
                detail += " Zones changed class: " + ", ".join(f"{c['zone']} {c['from']}->{c['to']}" for c in zc) + "."
        self._seq += 1
        self.events.append({"id": self._seq, "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                            "kind": kind, "title": title, "detail": detail, "changes": changes})

    def _mutate(self, kind: str, title: str, detail: str, fn) -> Dict[str, Any]:
        with self._lock:
            before = self._view()
            fn()
            after = self._view()
            self._log(kind, title, detail, before, after)
            return self.snapshot()

    def activate_scenario(self, scenario_id: str) -> Dict[str, Any]:
        if scenario_id not in self.scenarios:
            raise NotFound(scenario_id)
        s = self.scenarios[scenario_id]
        return self._mutate("scenario", f"Scenario activated: {s['name']}", s["description"],
                            lambda: self._load_scenario(scenario_id))

    def set_conditions(self, rainfall: Optional[float], trend: Optional[float], level: Optional[float]) -> Dict[str, Any]:
        def apply():
            if rainfall is not None:
                self.state["rainfall_mm_hr"] = float(rainfall)
            if trend is not None:
                self.state["rain_trend"] = float(trend)
            if level is not None:
                self.state["water_level_m"] = float(level)
            self.state["modified"] = True
        st = self.state
        return self._mutate("conditions", "Conditions updated",
                            f"Rainfall {rainfall if rainfall is not None else st['rainfall_mm_hr']:g} mm/h, trend "
                            f"{trend if trend is not None else st['rain_trend']:+g} mm/h per h, water level "
                            f"{level if level is not None else st['water_level_m']:g} m.", apply)

    def block_road(self, road_id: str) -> Dict[str, Any]:
        if road_id not in self.roads:
            raise NotFound(road_id)

        def apply():
            self.state["blocked"].add(road_id)
            self.state["modified"] = True
        return self._mutate("road", f"Road blocked: {self.roads[road_id]['name']}", f"{road_id} closed by operator.", apply)

    def reopen_road(self, road_id: str) -> Dict[str, Any]:
        if road_id not in self.roads:
            raise NotFound(road_id)
        was_blocked = road_id in self.state["blocked"]

        def apply():
            self.state["blocked"].discard(road_id)
            self.state["modified"] = True
        detail = f"{road_id} reopened by operator." if was_blocked else f"{road_id} was not manually blocked; no change."
        snap = self._mutate("road", f"Road reopened: {self.roads[road_id]['name']}", detail, apply)
        road = next(r for r in snap["roads"] if r["id"] == road_id)
        if road["status"] == "unsafe":
            self.events[-1]["detail"] += " The road remains unsafe because of flood depth and stays excluded from routing."
            snap = self.snapshot()
        return snap

    def plan_route(self, origin: str, party_size: int, needs_step_free: bool, mode: str, kind: str) -> Dict[str, Any]:
        if origin not in self.nodes:
            raise NotFound(origin)
        if mode not in routing.MODES:
            raise ValueError(f"mode must be one of {sorted(routing.MODES)}")
        req = {"origin_node_id": origin, "party_size": party_size, "needs_step_free": needs_step_free,
               "mode": mode, "destination_kind": kind}

        def apply():
            self.state["route"] = req
        return self._mutate("route", f"Route planned from {self.nodes[origin]['label']}",
                            f"Mode {mode}, party of {party_size}"
                            f"{', step-free required' if needs_step_free else ''}, destination: {kind}.", apply)

    def reset(self) -> Dict[str, Any]:
        with self._lock:
            self.state = {}
            self.events = []
            self._seq = 0
            self._load_scenario("baseline")
            self._log("system", "Simulation reset", "Deterministic baseline restored; event history cleared.")
            return self.snapshot()

    def get_events(self, limit: int = 100) -> List[Dict[str, Any]]:
        with self._lock:
            return list(reversed(self.events))[:limit]

    def config(self) -> Dict[str, Any]:
        return {
            "risk": self.cfg.to_dict(),
            "flood": {"unsafe_depth_m": self.unsafe_depth, "restricted_depth_m": self.restricted_depth,
                      "rule": "depth = max(0, water_level - road_elevation); unsafe at/above the unsafe depth, "
                              "restricted at/above the restricted depth or when the zone is high risk."},
            "routing": {"algorithm": "Dijkstra on a risk-weighted graph; Yen's algorithm for alternatives",
                        "modes": routing.MODES, "excluded_statuses": sorted(routing.EXCLUDED_STATUSES),
                        "cost": "distance_m x (1 + lambda x (road_risk/100 + 0.5 x min(depth/unsafe_depth, 1)))",
                        "speed_kmh": routing.SPEED_KMH,
                        "travel_time_rule": "speed = class speed x max(0.3, 1 - 0.5 x risk/100). A rough estimate under "
                                            "stated assumptions, not a traffic model."},
            "forecast": self.model.info(),
            "dataset": {"name": self.city["name"], "disclaimer": self.city["disclaimer"]},
        }
