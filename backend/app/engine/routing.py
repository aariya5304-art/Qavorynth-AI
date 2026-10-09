"""Evacuation routing: Dijkstra, Yen's k-shortest paths and facility selection.

Roads are undirected edges between intersection nodes. Blocked and unsafe roads are removed
from the graph before search, so they can never appear in a returned route. Edge cost is
risk-weighted distance:  cost = distance_m * (1 + lambda * (road_risk/100 + depth_penalty)).
"""
from __future__ import annotations

import heapq
import math
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

Adj = Dict[str, List[Tuple[str, str]]]
Path = Tuple[List[str], List[str]]  # (node sequence, road id sequence)

MODES = {"fastest": 0.0, "balanced": 1.0, "safest": 2.5}   # risk-aversion lambda
EXCLUDED_STATUSES = frozenset({"blocked", "unsafe"})
SPEED_KMH = {"arterial": 40.0, "local": 25.0}              # documented prototype assumption


def build_adjacency(roads: Iterable[Dict[str, Any]]) -> Adj:
    adj: Adj = {}
    for r in roads:
        adj.setdefault(r["a"], []).append((r["b"], r["id"]))
        adj.setdefault(r["b"], []).append((r["a"], r["id"]))
    for k in adj:
        adj[k].sort()
    return adj


def dijkstra(adj: Adj, source: str, cost: Callable[[str], float], banned_roads: Set[str] = frozenset(),
             banned_nodes: Set[str] = frozenset(), targets: Optional[Set[str]] = None):
    """Single-source Dijkstra with deterministic tie-breaking. Stops early once all targets settle."""
    dist: Dict[str, float] = {source: 0.0}
    prev: Dict[str, Tuple[str, str]] = {}
    heap: List[Tuple[float, str]] = [(0.0, source)]
    done: Set[str] = set()
    remaining = set(targets) if targets else None
    while heap:
        d, u = heapq.heappop(heap)
        if u in done:
            continue
        done.add(u)
        if remaining is not None:
            remaining.discard(u)
            if not remaining:
                break
        for v, rid in adj.get(u, ()):
            if rid in banned_roads or v in banned_nodes or v in done:
                continue
            c = cost(rid)
            if not math.isfinite(c) or c < 0:
                raise ValueError(f"edge cost for {rid} must be finite and non-negative")
            nd = d + c
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                prev[v] = (u, rid)
                heapq.heappush(heap, (nd, v))
    return dist, prev


def reconstruct(prev: Dict[str, Tuple[str, str]], source: str, target: str) -> Optional[Path]:
    if target == source:
        return [source], []
    if target not in prev:
        return None
    nodes, roads = [target], []
    cur = target
    while cur != source:
        p, rid = prev[cur]
        roads.append(rid)
        nodes.append(p)
        cur = p
    nodes.reverse()
    roads.reverse()
    return nodes, roads


def k_shortest_paths(adj: Adj, source: str, target: str, cost: Callable[[str], float],
                     banned_roads: Set[str] = frozenset(), k: int = 3) -> List[Tuple[float, List[str], List[str]]]:
    """Yen's algorithm: up to k loop-free paths ordered by cost."""
    dist, prev = dijkstra(adj, source, cost, banned_roads, targets={target})
    first = reconstruct(prev, source, target) if target in dist else None
    if first is None:
        return []

    def pcost(roads: List[str]) -> float:
        return sum(cost(r) for r in roads)

    accepted = [(pcost(first[1]), first[0], first[1])]
    candidates: List[Tuple[float, Tuple[str, ...], Tuple[str, ...]]] = []
    seen = {tuple(first[1])}
    while len(accepted) < k:
        _, last_nodes, last_roads = accepted[-1]
        for i in range(len(last_nodes) - 1):
            spur = last_nodes[i]
            root_nodes, root_roads = last_nodes[: i + 1], last_roads[:i]
            removed = set(banned_roads)
            for _c, pn, pr in accepted:
                if pn[: i + 1] == root_nodes and len(pr) > i:
                    removed.add(pr[i])
            d2, p2 = dijkstra(adj, spur, cost, removed, set(root_nodes[:-1]), targets={target})
            if target in d2:
                sp = reconstruct(p2, spur, target)
                if sp:
                    roads = root_roads + sp[1]
                    if tuple(roads) not in seen:
                        seen.add(tuple(roads))
                        heapq.heappush(candidates, (pcost(roads), tuple(root_nodes[:-1] + sp[0]), tuple(roads)))
        if not candidates:
            break
        c, n, r = heapq.heappop(candidates)
        accepted.append((c, list(n), list(r)))
    return accepted


def road_cost(road: Dict[str, Any], lam: float, unsafe_depth_m: float) -> float:
    depth_pen = min(road["depth_m"] / unsafe_depth_m, 1.0) * 0.5 if unsafe_depth_m > 0 else 0.0
    return road["distance_m"] * (1.0 + lam * (road["risk_score"] / 100.0 + depth_pen))


def travel_minutes(road: Dict[str, Any]) -> float:
    speed = SPEED_KMH.get(road["road_class"], 25.0) * max(0.3, 1.0 - 0.5 * road["risk_score"] / 100.0)
    return road["distance_m"] / 1000.0 / speed * 60.0


def _facility_view(f: Dict[str, Any]) -> Dict[str, Any]:
    return {"id": f["id"], "name": f["name"], "kind": f["kind"], "node_id": f["node_id"],
            "capacity": f["capacity"], "occupancy": f["occupancy"], "available": f["available"]}


def plan_evacuation(*, roads: List[Dict[str, Any]], facilities: List[Dict[str, Any]], node_ids: Set[str],
                    origin_node: str, party_size: int = 1, needs_step_free: bool = False,
                    mode: str = "balanced", destination_kind: str = "shelter",
                    unsafe_depth_m: float = 0.3, k_alternatives: int = 3) -> Dict[str, Any]:
    """Pick the best reachable facility and the route to it. Never invents a route."""
    if mode not in MODES:
        raise ValueError(f"unknown mode {mode!r}")
    if origin_node not in node_ids:
        raise KeyError(origin_node)
    lam = MODES[mode]
    by_id = {r["id"]: r for r in roads}
    banned = {r["id"] for r in roads if r["status"] in EXCLUDED_STATUSES}
    step_free_excluded = 0
    if needs_step_free:
        extra = {r["id"] for r in roads if not r["step_free"]} - banned
        step_free_excluded = len(extra)
        banned |= extra
    adj = build_adjacency(roads)
    cost = lambda rid: road_cost(by_id[rid], lam, unsafe_depth_m)  # noqa: E731

    base: Dict[str, Any] = {"origin_node_id": origin_node, "mode": mode, "party_size": party_size,
                            "needs_step_free": needs_step_free, "destination_kind": destination_kind,
                            "excluded_road_count": len(banned), "step_free_excluded_roads": step_free_excluded,
                            "facility": None, "node_path": [], "road_path": [], "total_distance_m": 0.0,
                            "total_cost": 0.0, "est_travel_min": 0.0, "max_road_risk": 0.0,
                            "alternatives": [], "candidates": [], "warnings": []}

    pool = [f for f in facilities if f["kind"] == destination_kind]
    eligible, candidates = [], []
    for f in pool:
        reason = None
        if not f["operational"]:
            reason = "Unavailable: flooded or closed"
        elif f["available"] < party_size:
            reason = f"Insufficient capacity ({f['available']} free, {party_size} needed)"
        elif needs_step_free and not f["step_free"]:
            reason = "Not step-free accessible"
        cand = {**_facility_view(f), "eligible": reason is None, "reachable": None, "cost": None,
                "distance_m": None, "reason": reason or "Eligible"}
        candidates.append(cand)
        if reason is None:
            eligible.append((f, cand))

    if not eligible:
        base.update(status="no_shelter", candidates=candidates,
                    message=f"No {destination_kind} meets the capacity, accessibility and safety requirements. "
                            "No alternative was invented.")
        return base

    dist, prev = dijkstra(adj, origin_node, cost, banned, targets={f["node_id"] for f, _ in eligible})
    best = None
    for f, cand in eligible:
        reachable = f["node_id"] in dist
        cand["reachable"] = reachable
        if not reachable:
            cand["reason"] = "Unreachable using roads that are not blocked or unsafe"
            continue
        path = reconstruct(prev, origin_node, f["node_id"])
        cand["cost"] = round(dist[f["node_id"]], 1)
        cand["distance_m"] = round(sum(by_id[r]["distance_m"] for r in path[1]), 1)
        key = (dist[f["node_id"]], -f["available"], f["id"])
        if best is None or key < best[0]:
            best = (key, f, path)
    if best is None:
        base.update(status="no_route", candidates=candidates,
                    message="No eligible facility is reachable from the selected origin using roads that are not "
                            "blocked or unsafe. No alternative route was invented.")
        return base

    _, fac, (nodes, rids) = best
    # defensive invariant: a route must never contain an excluded edge
    if any(r in banned for r in rids):
        base.update(status="no_route", candidates=candidates,
                    message="Internal validation rejected a route containing an excluded road.")
        return base

    used = [by_id[r] for r in rids]
    warnings = []
    if any(r["status"] == "restricted" for r in used):
        warnings.append("Route uses restricted roads (elevated risk or shallow water); drive with caution.")
    after = fac["occupancy"] + party_size
    if after / fac["capacity"] >= 0.85:
        warnings.append(f"{fac['name']} would be at {after / fac['capacity']:.0%} capacity after this party.")
    if mode == "fastest":
        warnings.append("Fastest mode ignores road risk when choosing between routes.")

    alts = []
    for rank, (c, n, r) in enumerate(k_shortest_paths(adj, origin_node, fac["node_id"], cost, banned,
                                                       k_alternatives + 1)[1:], start=1):
        alts.append({"rank": rank, "node_path": n, "road_path": r, "cost": round(c, 1),
                     "distance_m": round(sum(by_id[x]["distance_m"] for x in r), 1),
                     "max_road_risk": max((by_id[x]["risk_score"] for x in r), default=0.0)})

    base.update(
        status="ok", message=f"Route to {fac['name']} found.", facility=_facility_view(fac), node_path=nodes,
        road_path=rids, total_distance_m=round(sum(r["distance_m"] for r in used), 1),
        total_cost=round(dist[fac["node_id"]], 1),
        est_travel_min=round(sum(travel_minutes(r) for r in used), 1),
        max_road_risk=max((r["risk_score"] for r in used), default=0.0),
        alternatives=alts, candidates=candidates, warnings=warnings,
    )
    return base
