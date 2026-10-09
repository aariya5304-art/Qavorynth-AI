import math
import unittest

from app.engine.risk import RiskConfig, classify, compute_risk, normalize


class RiskTests(unittest.TestCase):
    def test_formula_matches_documented_weights(self):
        r = compute_risk(50, 5, 15, 6000, 1.0)  # every input sits at 50% of its range
        self.assertAlmostEqual(r["score"], 50.0, places=1)
        self.assertEqual(r["classification"], "medium")
        self.assertAlmostEqual(sum(c["contribution"] for c in r["components"].values()), r["score"], delta=0.05)

    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(RiskConfig().weights.values()), 1.0)

    def test_clamped_to_0_100(self):
        hi = compute_risk(1e6, 1e6, -500, 1e9, 1.0)
        lo = compute_risk(0, 0, 1e5, 0, 1.0)
        self.assertEqual(hi["score"], 100.0)
        self.assertEqual(lo["score"], 0.0)

    def test_thresholds(self):
        cfg = RiskConfig()
        self.assertEqual(classify(34.9, cfg), "low")
        self.assertEqual(classify(35.0, cfg), "medium")
        self.assertEqual(classify(64.9, cfg), "medium")
        self.assertEqual(classify(65.0, cfg), "high")

    def test_units_are_normalised_not_mixed(self):
        # 100 mm/h and 10 m both map to 100, 1000 people/km2 maps to a small number
        self.assertEqual(normalize(100, 0, 100), 100)
        self.assertEqual(normalize(10, 0, 10), 100)
        self.assertAlmostEqual(normalize(1200, 0, 12000), 10.0)
        self.assertEqual(normalize(30, 0, 30, invert=True), 0)

    def test_missing_and_invalid_inputs_are_safe(self):
        for bad in (None, "abc", float("nan"), float("inf"), -5, True):
            r = compute_risk(bad, 1, 10, 1000, 1.0)
            self.assertTrue(0 <= r["score"] <= 100)
            self.assertEqual(r["data_quality"], "degraded")
            self.assertTrue(r["components"]["rainfall"]["imputed"])
            self.assertTrue(r["warnings"])

    def test_negative_elevation_is_valid(self):
        r = compute_risk(10, 1, -2, 1000, 1.0)
        self.assertFalse(r["components"]["low_elevation"]["imputed"])
        self.assertEqual(r["components"]["low_elevation"]["normalized"], 100.0)

    def test_river_proximity_scales_water_component(self):
        near = compute_risk(10, 8, 10, 1000, 1.0)["components"]["water_level"]["normalized"]
        far = compute_risk(10, 8, 10, 1000, 0.25)["components"]["water_level"]["normalized"]
        self.assertAlmostEqual(far, near * 0.25, places=1)

    def test_monotonic_in_rain_and_level(self):
        a = compute_risk(10, 2, 10, 5000, 1.0)["score"]
        b = compute_risk(60, 2, 10, 5000, 1.0)["score"]
        c = compute_risk(60, 8, 10, 5000, 1.0)["score"]
        self.assertLess(a, b)
        self.assertLess(b, c)

    def test_explanation_present(self):
        self.assertIn("prototype", compute_risk(10, 1, 10, 1000)["explanation"])


if __name__ == "__main__":
    unittest.main()
