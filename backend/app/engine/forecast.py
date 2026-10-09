"""Short-horizon water-level forecaster (ridge regression, pure Python).

IMPORTANT: the model is trained at start-up on SYNTHETIC hourly sequences produced by a documented
toy catchment simulation. It demonstrates the prediction pipeline (features -> model -> uncertainty ->
risk re-scoring); it has no real-world forecasting skill and must not be used for real warnings.
"""
from __future__ import annotations

import math
import random
from typing import Any, Dict, List, Sequence, Tuple

HORIZONS = (1, 2, 3)
Z80 = 1.2816  # one-sided z for an 80% central interval


def _step(level: float, r0: float, r1: float, r2: float, noise: float) -> float:
    inflow = 0.012 * (0.6 * r0 + 0.3 * r1 + 0.1 * r2) * (1 + 0.04 * level)
    recession = 0.08 * (level - 0.4)
    return max(0.2, min(15.0, level + inflow - recession + noise))


def _features(r0: float, r1: float, r2: float, level: float) -> List[float]:
    return [r0, r1, r2, level, r0 * level, level * level, r0 * r0 / 100.0]


def _solve(a: List[List[float]], b: List[float]) -> List[float]:
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(m[r][col]))
        m[col], m[piv] = m[piv], m[col]
        p = m[col][col]
        if abs(p) < 1e-12:
            raise ValueError("singular matrix")
        for r in range(n):
            if r != col:
                f = m[r][col] / p
                for c in range(col, n + 1):
                    m[r][c] -= f * m[col][c]
    return [m[i][n] / m[i][i] for i in range(n)]


class WaterLevelModel:
    def __init__(self, seed: int = 2026, n_sequences: int = 1500, steps: int = 12, ridge: float = 1.0):
        self.seed, self.n_sequences, self.steps, self.ridge = seed, n_sequences, steps, ridge
        self.mean: List[float] = []
        self.std: List[float] = []
        self.coef: Dict[int, List[float]] = {}
        self.intercept: Dict[int, float] = {}
        self.sigma: Dict[int, float] = {}
        self.metrics: Dict[int, Dict[str, float]] = {}
        self.fit()

    def _simulate(self, rng: random.Random):
        rain, level = rng.uniform(0, 90), rng.uniform(0.3, 9.0)
        slope = rng.uniform(-8, 8)
        rains, levels = [rain], [level]
        for _ in range(self.steps - 1):
            rain = max(0.0, rain + rng.gauss(slope, 6.0))
            r1 = rains[-2] if len(rains) > 1 else rains[-1]
            r2 = rains[-3] if len(rains) > 2 else r1
            level = _step(level, rains[-1], r1, r2, rng.gauss(0, 0.05))
            rains.append(rain)
            levels.append(level)
        return rains, levels

    def fit(self) -> None:
        rng = random.Random(self.seed)
        train: List[Tuple[List[float], Dict[int, float]]] = []
        valid: List[Tuple[List[float], Dict[int, float]]] = []
        for s in range(self.n_sequences):
            rains, levels = self._simulate(rng)
            bucket = valid if s % 5 == 0 else train
            for t in range(2, self.steps - max(HORIZONS)):
                bucket.append((_features(rains[t], rains[t - 1], rains[t - 2], levels[t]),
                               {h: levels[t + h] for h in HORIZONS}))
        nf = len(train[0][0])
        self.mean = [sum(x[i] for x, _ in train) / len(train) for i in range(nf)]
        self.std = [max(1e-9, math.sqrt(sum((x[i] - self.mean[i]) ** 2 for x, _ in train) / len(train)))
                    for i in range(nf)]
        z = lambda x: [(x[i] - self.mean[i]) / self.std[i] for i in range(nf)]  # noqa: E731
        zt = [z(x) for x, _ in train]
        for h in HORIZONS:
            y = [t[h] for _, t in train]
            ym = sum(y) / len(y)
            xtx = [[sum(r[i] * r[j] for r in zt) + (self.ridge if i == j else 0.0) for j in range(nf)]
                   for i in range(nf)]
            xty = [sum(r[i] * (yy - ym) for r, yy in zip(zt, y)) for i in range(nf)]
            self.coef[h] = _solve(xtx, xty)
            self.intercept[h] = ym
            errs = [t[h] - self._raw(x, h) for x, t in valid]
            ys = [t[h] for _, t in valid]
            yv = sum(ys) / len(ys)
            ss_res = sum(e * e for e in errs)
            ss_tot = sum((v - yv) ** 2 for v in ys)
            self.sigma[h] = math.sqrt(ss_res / len(errs))
            self.metrics[h] = {"mae_m": round(sum(abs(e) for e in errs) / len(errs), 3),
                               "rmse_m": round(self.sigma[h], 3), "r2": round(1 - ss_res / ss_tot, 4)}
        self.n_train, self.n_valid = len(train), len(valid)

    def _raw(self, x: Sequence[float], h: int) -> float:
        zx = [(x[i] - self.mean[i]) / self.std[i] for i in range(len(x))]
        return self.intercept[h] + sum(c * v for c, v in zip(self.coef[h], zx))

    def predict(self, rain_hist: Sequence[float], level: float, h: int) -> Dict[str, float]:
        r2, r1, r0 = rain_hist
        mid = max(0.0, min(15.0, self._raw(_features(r0, r1, r2, level), h)))
        return {"mid": mid, "lo": max(0.0, mid - Z80 * self.sigma[h]), "hi": min(15.0, mid + Z80 * self.sigma[h])}

    def info(self) -> Dict[str, Any]:
        return {
            "type": "Ridge regression, one model per horizon (1h, 2h, 3h)",
            "features": ["rain_t", "rain_t-1", "rain_t-2", "level_t", "rain_t x level_t", "level_t^2", "rain_t^2/100"],
            "training_data": f"{self.n_train} train / {self.n_valid} validation samples from "
                             f"{self.n_sequences} synthetic sequences (seed {self.seed})",
            "validation": {f"+{h}h": self.metrics[h] for h in HORIZONS},
            "interval": "80% interval = prediction +/- 1.28 x validation RMSE",
            "assumptions": [
                "Future rainfall follows the scenario's linear trend (persistence plus slope), floored at 0 mm/h.",
                "Trained only on synthetic toy-catchment dynamics; accuracy figures describe that simulation, not reality.",
                "Rainfall uncertainty is not modelled; intervals reflect water-level model error only.",
            ],
        }


def rain_history(rain: float, slope: float) -> List[float]:
    return [max(0.0, rain - 2 * slope), max(0.0, rain - slope), max(0.0, rain)]
