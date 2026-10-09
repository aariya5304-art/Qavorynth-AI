"""Derive alerts deterministically from current state. No randomness, no invented incidents."""
from __future__ import annotations

from typing import Any, Dict, List

SEV_ORDER = {"critical": 0, "warning": 1, "info": 2}


def derive_alerts(zones: List[Dict[str, Any]], roads: List[Dict[str, Any]], facilities: List[Dict[str, Any]],
                  forecast: Dict[str, Any]) -> List[Dict[str, Any]]:
    alerts: List[Dict[str, Any]] = []
    for z in zones:
        r = z["risk"]
        if r["classification"] == "high":
            alerts.append({"id": f"zone-high-{z['id']}", "severity": "critical", "kind": "zone",
                           "title": f"{z['name']} is in the high-risk class",
                           "detail": f"Score {r['score']:.1f} (threshold 65). Population {z['population']:,}.",
                           "ref": z["id"]})
        if r["data_quality"] == "degraded":
            alerts.append({"id": f"zone-data-{z['id']}", "severity": "info", "kind": "data",
                           "title": f"{z['name']}: degraded input data",
                           "detail": "; ".join(r["warnings"]), "ref": z["id"]})
    for h in forecast["hotspots"]:
        z = next(zz for zz in zones if zz["id"] == h["zone_id"])
        if z["risk"]["classification"] != "high":
            if h["first_high_hour"] is not None:
                alerts.append({"id": f"forecast-high-{h['zone_id']}", "severity": "warning", "kind": "forecast",
                               "title": f"{h['name']} forecast to reach high risk in +{h['first_high_hour']}h",
                               "detail": f"Modelled score {h['current']:.1f} now, {h['at_3h']:.1f} at +3h "
                                         "(synthetic-trained model).", "ref": h["zone_id"]})
            elif h["possible_high_hour"] is not None:
                alerts.append({"id": f"forecast-possible-{h['zone_id']}", "severity": "info", "kind": "forecast",
                               "title": f"{h['name']} could reach high risk by +{h['possible_high_hour']}h",
                               "detail": "Upper end of the 80% interval crosses the high threshold.",
                               "ref": h["zone_id"]})
    blocked = [r for r in roads if r["status"] == "blocked"]
    unsafe = [r for r in roads if r["status"] == "unsafe"]
    for r in blocked:
        alerts.append({"id": f"road-blocked-{r['id']}", "severity": "warning", "kind": "road",
                       "title": f"{r['name']} is closed", "detail": f"Road {r['id']} manually blocked.",
                       "ref": r["id"]})
    if unsafe:
        alerts.append({"id": "roads-unsafe", "severity": "critical" if len(unsafe) >= 5 else "warning",
                       "kind": "road", "title": f"{len(unsafe)} road segments unsafe from flood depth",
                       "detail": "Excluded from all routing: " + ", ".join(r["id"] for r in unsafe[:12])
                                 + ("..." if len(unsafe) > 12 else ""), "ref": None})
    for f in facilities:
        if not f["operational"]:
            alerts.append({"id": f"facility-flooded-{f['id']}", "severity": "critical", "kind": "facility",
                           "title": f"{f['name']} is flooded and unavailable",
                           "detail": f"Water depth at site {f['flood_depth_m']:.2f} m.", "ref": f["id"]})
        elif f["status"] in ("near_full", "full"):
            alerts.append({"id": f"facility-full-{f['id']}", "severity": "warning", "kind": "facility",
                           "title": f"{f['name']} at {f['occupancy_pct']:.0f}% occupancy",
                           "detail": f"{f['available']} places remain.", "ref": f["id"]})
    alerts.sort(key=lambda a: (SEV_ORDER[a["severity"]], a["id"]))
    return alerts
