import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

client = TestClient(app)


def setup_function(_):
    client.post("/api/simulation/reset")


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_scenario_and_lists():
    snap = client.get("/api/scenario").json()
    assert snap["scenario"]["id"] == "baseline"
    assert len(client.get("/api/zones").json()) == snap["metrics"]["total_zones"]
    assert len(client.get("/api/roads").json()) == 49
    assert any(f["kind"] == "shelter" for f in client.get("/api/shelters").json())


def test_risk_calculate_validation_and_missing():
    ok = client.post("/api/risk/calculate", json={"rainfall_mm_hr": 50, "water_level_m": 5, "elevation_m": 15,
                                                    "population_density_per_km2": 6000})
    assert ok.status_code == 200 and 0 <= ok.json()["score"] <= 100
    assert client.post("/api/risk/calculate", json={"rainfall_mm_hr": -1}).status_code == 422
    partial = client.post("/api/risk/calculate", json={"rainfall_mm_hr": 20}).json()
    assert partial["data_quality"] == "degraded"


def test_conditions_block_reopen_route_reset_events():
    snap = client.put("/api/scenario/conditions", json={"rainfall_mm_hr": 90, "water_level_m": 8}).json()
    assert snap["metrics"]["high_risk_zones"] > 0
    assert client.put("/api/scenario/conditions", json={"rainfall_mm_hr": 9999}).status_code == 422
    assert client.post("/api/roads/R010/block").json()["metrics"]["blocked_roads"] >= 1
    assert client.post("/api/roads/R010/reopen").status_code == 200
    assert client.post("/api/roads/NOPE/block").status_code == 404
    route = client.post("/api/routes/evacuation", json={"origin_node_id": "N20"}).json()["route"]
    assert route["status"] in ("ok", "no_route", "no_shelter")
    assert client.post("/api/routes/evacuation", json={"origin_node_id": "N99"}).status_code == 404
    assert client.post("/api/routes/evacuation", json={"origin_node_id": "N20", "mode": "x"}).status_code == 422
    assert client.get("/api/events").json()
    assert client.post("/api/simulation/reset").json()["scenario"]["id"] == "baseline"
    assert client.post("/api/scenarios/unknown/activate").status_code == 404


def test_sessions_are_isolated():
    a, b = {"X-Session-Id": "judge-a"}, {"X-Session-Id": "judge-b"}
    client.post("/api/simulation/reset", headers=a)
    client.post("/api/simulation/reset", headers=b)
    client.put("/api/scenario/conditions", json={"rainfall_mm_hr": 120, "water_level_m": 9}, headers=a)
    assert client.get("/api/scenario", headers=a).json()["scenario"]["rainfall_mm_hr"] == 120
    assert client.get("/api/scenario", headers=b).json()["scenario"]["rainfall_mm_hr"] == 8
