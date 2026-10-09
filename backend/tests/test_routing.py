import unittest

from app.engine.routing import (build_adjacency, dijkstra, k_shortest_paths, plan_evacuation, reconstruct)


def road(i, a, b, d, status="open", risk=0.0, depth=0.0, cls="local", sf=True):
    return {"id": i, "a": a, "b": b, "distance_m": d, "status": status, "risk_score": risk, "depth_m": depth,
            "road_class": cls, "step_free": sf}


def fac(i, node, cap=100, occ=0, op=True, sf=True, kind="shelter"):
    return {"id": i, "name": f"Fac {i}", "kind": kind, "node_id": node, "capacity": cap, "occupancy": occ,
            "available": max(0, cap - occ) if op else 0, "operational": op, "step_free": sf}


# A --1-- B --1-- D       two routes A->D: A-B-D (cost 2) and A-C-D (cost 5)
#  \             /
#   4-- C ---1---
GRAPH = [road("r1", "A", "B", 1), road("r2", "B", "D", 1), road("r3", "A", "C", 4), road("r4", "C", "D", 1)]
NODES = {"A", "B", "C", "D"}


class DijkstraTests(unittest.TestCase):
    def test_shortest_path(self):
        adj = build_adjacency(GRAPH)
        cost = {r["id"]: r["distance_m"] for r in GRAPH}.get
        dist, prev = dijkstra(adj, "A", cost)
        self.assertEqual(dist["D"], 2)
        self.assertEqual(reconstruct(prev, "A", "D"), (["A", "B", "D"], ["r1", "r2"]))

    def test_banned_road_is_never_used(self):
        adj = build_adjacency(GRAPH)
        cost = {r["id"]: r["distance_m"] for r in GRAPH}.get
        dist, prev = dijkstra(adj, "A", cost, banned_roads={"r2"})
        self.assertEqual(dist["D"], 5)
        self.assertNotIn("r2", reconstruct(prev, "A", "D")[1])

    def test_unreachable(self):
        adj = build_adjacency(GRAPH)
        cost = {r["id"]: r["distance_m"] for r in GRAPH}.get
        dist, prev = dijkstra(adj, "A", cost, banned_roads={"r2", "r4"})
        self.assertNotIn("D", dist)
        self.assertIsNone(reconstruct(prev, "A", "D"))

    def test_negative_cost_rejected(self):
        with self.assertRaises(ValueError):
            dijkstra(build_adjacency(GRAPH), "A", lambda r: -1.0)

    def test_yen_returns_ordered_distinct_paths(self):
        adj = build_adjacency(GRAPH)
        cost = {r["id"]: r["distance_m"] for r in GRAPH}.get
        paths = k_shortest_paths(adj, "A", "D", cost, k=3)
        self.assertEqual([p[0] for p in paths], [2, 5])
        self.assertEqual(len({tuple(p[2]) for p in paths}), len(paths))

    def test_yen_respects_banned(self):
        adj = build_adjacency(GRAPH)
        cost = {r["id"]: r["distance_m"] for r in GRAPH}.get
        paths = k_shortest_paths(adj, "A", "D", cost, banned_roads={"r1"}, k=3)
        self.assertEqual(len(paths), 1)
        self.assertNotIn("r1", paths[0][2])


class PlanTests(unittest.TestCase):
    def plan(self, roads=GRAPH, facilities=None, **kw):
        facilities = facilities if facilities is not None else [fac("S1", "D")]
        return plan_evacuation(roads=roads, facilities=facilities, node_ids=NODES, origin_node="A", **kw)

    def test_ok_route(self):
        r = self.plan()
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["node_path"], ["A", "B", "D"])
        self.assertEqual(r["total_distance_m"], 2)
        self.assertEqual(len(r["alternatives"]), 1)

    def test_blocked_and_unsafe_roads_excluded(self):
        for status in ("blocked", "unsafe"):
            roads = [dict(x) for x in GRAPH]
            roads[1]["status"] = status
            r = self.plan(roads=roads)
            self.assertEqual(r["status"], "ok")
            self.assertNotIn("r2", r["road_path"])
            self.assertEqual(r["node_path"], ["A", "C", "D"])

    def test_no_route_is_reported_not_invented(self):
        roads = [dict(x) for x in GRAPH]
        roads[1]["status"] = "blocked"
        roads[3]["status"] = "unsafe"
        r = self.plan(roads=roads)
        self.assertEqual(r["status"], "no_route")
        self.assertEqual(r["road_path"], [])
        self.assertIsNone(r["facility"])

    def test_capacity_filters_shelters(self):
        r = self.plan(facilities=[fac("S1", "D", cap=10, occ=9)], party_size=5)
        self.assertEqual(r["status"], "no_shelter")
        self.assertIn("Insufficient capacity", r["candidates"][0]["reason"])

    def test_nearer_full_shelter_skipped_for_farther_open_one(self):
        r = self.plan(facilities=[fac("S1", "B", cap=10, occ=10), fac("S2", "D")])
        self.assertEqual(r["facility"]["id"], "S2")

    def test_flooded_shelter_skipped(self):
        r = self.plan(facilities=[fac("S1", "B", op=False), fac("S2", "C")])
        self.assertEqual(r["facility"]["id"], "S2")

    def test_step_free_requirement(self):
        roads = [dict(x) for x in GRAPH]
        roads[0]["step_free"] = False
        r = self.plan(roads=roads, needs_step_free=True)
        self.assertEqual(r["node_path"], ["A", "C", "D"])
        r2 = self.plan(facilities=[fac("S1", "D", sf=False)], needs_step_free=True)
        self.assertEqual(r2["status"], "no_shelter")

    def test_risk_aversion_changes_route(self):
        roads = [dict(x) for x in GRAPH]
        roads[0]["risk_score"] = 100.0   # risky short route (both segments)
        roads[1]["risk_score"] = 100.0
        self.assertEqual(self.plan(roads=roads, mode="fastest")["node_path"], ["A", "B", "D"])
        self.assertEqual(self.plan(roads=roads, mode="safest")["node_path"], ["A", "C", "D"])

    def test_origin_at_facility(self):
        r = plan_evacuation(roads=GRAPH, facilities=[fac("S1", "A")], node_ids=NODES, origin_node="A")
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["road_path"], [])

    def test_unknown_origin_and_mode(self):
        with self.assertRaises(KeyError):
            plan_evacuation(roads=GRAPH, facilities=[], node_ids=NODES, origin_node="ZZ")
        with self.assertRaises(ValueError):
            self.plan(mode="teleport")


if __name__ == "__main__":
    unittest.main()
