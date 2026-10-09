import unittest

from app.engine.forecast import WaterLevelModel, rain_history


class ForecastTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.model = WaterLevelModel()

    def test_deterministic_training(self):
        other = WaterLevelModel()
        a = self.model.predict([40, 50, 60], 4.0, 2)
        b = other.predict([40, 50, 60], 4.0, 2)
        self.assertEqual(a, b)

    def test_more_rain_means_higher_forecast(self):
        low = self.model.predict(rain_history(10, 0), 2.0, 3)["mid"]
        high = self.model.predict(rain_history(80, 0), 2.0, 3)["mid"]
        self.assertGreater(high, low)

    def test_interval_brackets_prediction_and_widens(self):
        p1 = self.model.predict([30, 30, 30], 3.0, 1)
        p3 = self.model.predict([30, 30, 30], 3.0, 3)
        self.assertLessEqual(p1["lo"], p1["mid"])
        self.assertLessEqual(p1["mid"], p1["hi"])
        self.assertGreater(p3["hi"] - p3["lo"], p1["hi"] - p1["lo"])

    def test_outputs_stay_in_physical_range(self):
        p = self.model.predict([300, 300, 300], 15.0, 3)
        self.assertTrue(0 <= p["lo"] <= p["mid"] <= p["hi"] <= 15)

    def test_validation_metrics_reported(self):
        info = self.model.info()
        self.assertEqual(set(info["validation"]), {"+1h", "+2h", "+3h"})
        self.assertLess(info["validation"]["+1h"]["rmse_m"], info["validation"]["+3h"]["rmse_m"])

    def test_rain_history_never_negative(self):
        self.assertEqual(min(rain_history(5, 10)), 0.0)


if __name__ == "__main__":
    unittest.main()
