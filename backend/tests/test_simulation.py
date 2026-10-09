import itertools
import random
import unittest

from app.engine.routing import EXCLUDED_STATUSES
from app.simulation import NotFound, Simulation


class SimulationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sim = Simulation()

    def setUp(self):
        self.sim.reset()

    def test_dataset_is_consistent(self):
        s = self.sim
        for r in s.roads.values():
            self.assertIn(r["a"], s.nodes)
            self.assertIn(r["b"], s.nodes)
            self.assertIn(r["zone_id"], s.zones)
        for f in s.facilities.values():
            self.assertIn(f["node_id"], s.nodes)
            self.assertLessEqual(f["baseline_occupancy"], f["capacity"])
        self.assertGreaterEqual(len(s.zones), 6)

    def test_metrics_derive_from_data(self):
        snap = self.sim.snapshot()
        m = snap["metrics"]
        self.assertEqual(m["total_zones"], len(snap["zones"]))
        self.assertEqual(m["high_risk_zones"], sum(z["risk"]["classification"] == "high" for z in snap["zones"]))
        self.assertEqual(m["blocked_roads"], sum(r["status"] == "blocked" for r in snap["roads"]))
        self.assertEqual(m["available_shelter_capacity"],
                         sum(f["available"] for f in snap["facilities"] if f["kind"] == "shelter"))
        self.assertEqual(m["active_alerts"], sum(a["severity"] != "info" for a in snap["alerts"]))

    def test_baseline_has_two_alternative_routes(self):
        r = self.sim.snapshot()["route"]
        self.assertEqual(r["status"], "ok")
        self.assertGreaterEqual(len(r["alternatives"]), 1)

    def test_rainfall_and_level_change_recalculates_everything(self):
        before = self.sim.snapshot()
        after = self.sim.set_conditions(90, 5, 8)
        self.assertGreater(after["metrics"]["high_risk_zones"], before["metrics"]["high_risk_zones"])
        self.assertGreater(after["metrics"]["unsafe_roads"], 0)
        self.assertLess(after["metrics"]["available_shelter_capacity"], before["metrics"]["available_shelter_capacity"])
        self.assertTrue(after["scenario"]["modified"])
        self.assertTrue(after["alerts"])

    def test_heavy_scenario(self):
        snap = self.sim.activate_scenario("heavy-rain")
        self.assertGreaterEqual(snap["metrics"]["high_risk_zones"], 3)
        self.assertEqual(snap["route"]["status"], "ok")
        self.assertEqual(snap["metrics"]["operational_shelters"], snap["metrics"]["total_shelters"] - 1)

    def test_closure_scenario_reroutes(self):
        snap = self.sim.activate_scenario("road-closure")
        self.assertEqual(snap["scenario"]["blocked_roads"], ["R021"])
        self.assertNotIn("R021", snap["route"]["road_path"])
        self.assertNotEqual(snap["route"]["road_path"], snap["baseline"]["route"]["road_path"])
        self.assertGreater(snap["route"]["total_distance_m"], snap["baseline"]["route"]["total_distance_m"])
        ev = self.sim.get_events(1)[0]
        self.assertTrue(ev["changes"]["rerouted"])
        self.assertIn("Route changed", ev["detail"])

    def test_route_never_contains_excluded_road(self):
        rng = random.Random(1)
        for _ in range(60):
            self.sim.set_conditions(rng.uniform(0, 150), rng.uniform(-10, 10), rng.uniform(0, 12))
            for rid in rng.sample(sorted(self.sim.roads), 3):
                self.sim.block_road(rid)
            origin = rng.choice(sorted(self.sim.nodes))
            snap = self.sim.plan_route(origin, rng.choice([1, 50]), rng.random() < 0.3, rng.choice(["fastest", "balanced", "safest"]), "shelter")
            status = {r["id"]: r["status"] for r in snap["roads"]}
            for rid in snap["route"]["road_path"]:
                self.assertNotIn(status[rid], EXCLUDED_STATUSES)

    def test_no_route_when_origin_is_cut_off(self):
        origin = "N41"
        for rid, r in self.sim.roads.items():
            if origin in (r["a"], r["b"]):
                self.sim.block_road(rid)
        snap = self.sim.plan_route(origin, 1, False, "balanced", "shelter")
        self.assertEqual(snap["route"]["status"], "no_route")
        self.assertEqual(snap["route"]["road_path"], [])

    def test_reopen_manual_block_but_not_flood_unsafe(self):
        self.sim.block_road("R021")
        self.assertEqual(self.sim.reopen_road("R021")["metrics"]["blocked_roads"], 0)
        self.sim.set_conditions(None, None, 7.5)
        unsafe = next(r for r in self.sim.snapshot()["roads"] if r["status"] == "unsafe")
        snap = self.sim.reopen_road(unsafe["id"])
        self.assertEqual(next(r for r in snap["roads"] if r["id"] == unsafe["id"])["status"], "unsafe")

    def test_reset_is_deterministic(self):
        first = self.sim.snapshot()
        self.sim.activate_scenario("heavy-rain")
        self.sim.block_road("R010")
        again = self.sim.reset()
        strip = lambda s: {k: v for k, v in s.items() if k != "recent_events"}  # noqa: E731
        self.assertEqual(strip(first), strip(again))
        self.assertEqual(len(self.sim.get_events()), 1)

    def test_unknown_ids(self):
        with self.assertRaises(NotFound):
            self.sim.block_road("R999")
        with self.assertRaises(NotFound):
            self.sim.activate_scenario("nope")
        with self.assertRaises(NotFound):
            self.sim.plan_route("N99", 1, False, "balanced", "shelter")

    def test_events_logged_for_each_mutation(self):
        self.sim.set_conditions(30, 0, 2)
        self.sim.block_road("R010")
        kinds = [e["kind"] for e in self.sim.get_events()]
        self.assertEqual(kinds[:2], ["road", "conditions"])

    def test_forecast_hotspots_sorted_and_complete(self):
        snap = self.sim.activate_scenario("heavy-rain")
        hs = snap["forecast"]["hotspots"]
        self.assertEqual(len(hs), len(snap["zones"]))
        self.assertEqual([h["at_3h"] for h in hs], sorted((h["at_3h"] for h in hs), reverse=True))


if __name__ == "__main__":
    unittest.main()
