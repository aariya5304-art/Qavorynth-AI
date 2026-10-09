"""Transparent zone risk model (prototype).

risk_score = 0.35*rainfall + 0.30*water_level + 0.20*low_elevation + 0.15*population_exposure

Every component is first normalised to 0-100 with an explicit, unit-aware rule so that
millimetres, metres and people-per-km2 are never mixed directly. The thresholds below are
PROTOTYPE values for the synthetic city; they are not validated flood-warning thresholds.
"""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class RiskConfig:
    weights: Dict[str, float] = field(default_factory=lambda: {
        "rainfall": 0.35, "water_level": 0.30, "low_elevation": 0.20, "population_exposure": 0.15})
    rainfall_max_mm_hr: float = 100.0        # rainfall at/above this -> 100
    water_level_max_m: float = 10.0          # river stage (m above datum) at/above this -> 100
    elevation_safe_m: float = 30.0           # elevation at/above this -> 0 (inverted scale)
    population_density_max: float = 12000.0  # people per km2 at/above this -> 100
    missing_impute: float = 50.0             # neutral value used when an input is missing/invalid
    medium_threshold: float = 35.0
    high_threshold: float = 65.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


DEFAULT_CONFIG = RiskConfig()


def _clean(value: Any, allow_negative: bool = False) -> Optional[float]:
    """Return a finite float or None when the value is missing/invalid."""
    if value is None or isinstance(value, bool):
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(v):
        return None
    if v < 0 and not allow_negative:
        return None
    return v


def normalize(value: float, lo: float, hi: float, invert: bool = False) -> float:
    """Linear map of [lo, hi] -> [0, 100], clamped. `invert` flips the scale."""
    if hi <= lo:
        raise ValueError("normalisation range must have hi > lo")
    pct = (value - lo) / (hi - lo) * 100.0
    pct = max(0.0, min(100.0, pct))
    return 100.0 - pct if invert else pct


def classify(score: float, cfg: RiskConfig = DEFAULT_CONFIG) -> str:
    s = round(score, 1)
    if s >= cfg.high_threshold:
        return "high"
    if s >= cfg.medium_threshold:
        return "medium"
    return "low"


def compute_risk(rainfall_mm_hr: Any = None, water_level_m: Any = None, elevation_m: Any = None,
                 population_density_per_km2: Any = None, river_proximity: Any = 1.0,
                 cfg: RiskConfig = DEFAULT_CONFIG) -> Dict[str, Any]:
    """Compute a risk score with full component breakdown. Never raises on bad inputs."""
    warnings = []
    prox = _clean(river_proximity)
    if prox is None or prox > 1.0:
        if prox is not None and prox > 1.0:
            warnings.append("river_proximity above 1 was clamped to 1.")
            prox = 1.0
        else:
            warnings.append("river_proximity missing/invalid; assumed 1.0 (closest to river, conservative).")
            prox = 1.0

    specs = [
        ("rainfall", rainfall_mm_hr, False, "mm/h", lambda v: normalize(v, 0, cfg.rainfall_max_mm_hr),
         f"0 mm/h -> 0, {cfg.rainfall_max_mm_hr:g} mm/h -> 100 (linear)"),
        ("water_level", water_level_m, False, "m", lambda v: normalize(v, 0, cfg.water_level_max_m) * prox,
         f"0 m -> 0, {cfg.water_level_max_m:g} m -> 100 (linear), scaled by river proximity {prox:g}"),
        ("low_elevation", elevation_m, True, "m", lambda v: normalize(v, 0, cfg.elevation_safe_m, invert=True),
         f"{cfg.elevation_safe_m:g} m or higher -> 0, 0 m or lower -> 100 (inverted linear)"),
        ("population_exposure", population_density_per_km2, False, "people/km2",
         lambda v: normalize(v, 0, cfg.population_density_max),
         f"0 -> 0, {cfg.population_density_max:g} people/km2 -> 100 (linear)"),
    ]
    components: Dict[str, Any] = {}
    score = 0.0
    inputs: Dict[str, Any] = {}
    degraded = False
    for name, raw, allow_neg, unit, fn, rule in specs:
        v = _clean(raw, allow_negative=allow_neg)
        imputed = v is None
        if imputed:
            degraded = True
            norm = cfg.missing_impute
            warnings.append(f"{name} input missing/invalid; imputed {cfg.missing_impute:g}/100 (low confidence).")
        else:
            norm = fn(v)
        w = cfg.weights[name]
        contribution = w * norm
        score += contribution
        inputs[name] = None if imputed else v
        components[name] = {"input": None if imputed else v, "unit": unit, "normalized": round(norm, 2),
                            "weight": w, "contribution": round(contribution, 2), "imputed": imputed,
                            "rule": rule}
    score = max(0.0, min(100.0, score))
    rounded = round(score, 1)
    parts = " + ".join(f"{c['weight']:.2f}x{c['normalized']:.1f}" for c in components.values())
    return {
        "score": rounded,
        "classification": classify(score, cfg),
        "components": components,
        "inputs": inputs,
        "warnings": warnings,
        "data_quality": "degraded" if degraded else "complete",
        "explanation": (f"risk = {parts} = {rounded:.1f} -> {classify(score, cfg)} "
                        f"(low <{cfg.medium_threshold:g}, medium <{cfg.high_threshold:g}, high >= "
                        f"{cfg.high_threshold:g}; prototype thresholds, not validated warning levels)"),
    }
