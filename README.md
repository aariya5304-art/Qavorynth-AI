# Qavorynth AI

**Predict the danger. Protect the people. Find the safest way out.**

Urban flood-operations dashboard for the ARCOVA / ARTIWHIZ 2026 challenge *AI-Based Urban Disaster Risk
Prediction & Dynamic Evacuation System*. It runs on a clearly labelled **synthetic city ("Halden Basin")**
with no paid APIs, keys or live feeds.

## What it does

| Capability | Implementation |
|---|---|
| Zone risk scoring | `backend/app/engine/risk.py`: `0.35 rain + 0.30 water level + 0.20 low elevation + 0.15 population exposure`, unit-aware 0–100 normalisation, clamped, low/medium/high at 35/65, invalid inputs imputed and flagged |
| Short-horizon prediction | `engine/forecast.py`: ridge-regression water-level model (+1/+2/+3 h) with 80% intervals, re-scored through the risk engine to rank hotspots and estimate when each zone may turn high-risk |
| Routing | `engine/routing.py`: Dijkstra on a risk-weighted graph, Yen's k-shortest alternatives, blocked and flood-unsafe roads removed before search, explicit `no_route` / `no_shelter` results |
| Shelter choice | reachability, free capacity, step-free access, flooded sites excluded, lowest risk-weighted cost wins |
| Simulation | 3 reproducible scenarios, rainfall/trend/water-level sliders, block/reopen roads, origin picker, deterministic reset |
| Dashboard | Leaflet map (zones, roads, route, facilities, layer toggles, +0..+3 h risk view), metrics, charts, alerts, shelter list, event log, methodology |

Every metric, alert and chart is computed from the dataset and current scenario state. Nothing is hard-coded.

### Honest notes on the "AI"
- The forecaster is a small ridge regression trained at start-up on **synthetic** sequences from a documented toy
  catchment simulation. Its validation scores (shown in *Methodology*) describe that simulation, not real flooding.
  It demonstrates the pipeline; swap in real gauge/rain history before claiming any forecasting skill.
- Routing is classical (Dijkstra/Yen). It is exact and explainable, which is the point for emergency use.
- Travel time is a rough estimate from documented speed assumptions, not a traffic model.
- Risk thresholds are prototype values, not validated flood-warning levels.

## Run locally

Requires Python 3.11+ and Node 18+.

```bash
# 1) API  (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000                # docs at http://localhost:8000/docs

# 2) Web app  (terminal 2)
cd frontend
cp .env.example .env                                     # VITE_API_BASE_URL=http://localhost:8000
npm install
npm run dev                                              # http://localhost:5173
```

## Tests and checks

```bash
cd backend && pip install -r requirements-dev.txt && pytest -q      # engines, simulation, API
cd frontend && npm run check                                         # tsc --noEmit + vite build
# no pytest? the engine and simulation tests also run with:  python -m unittest discover -s tests -t . -p "test_[rfs]*.py"
```

## Layout

```
backend/app/engine/{risk,routing,forecast,alerts}.py   business logic (no web code)
backend/app/simulation.py                              scenario state -> risk -> roads -> routes -> alerts -> events
backend/app/main.py, models.py                         FastAPI + Pydantic
backend/app/data/{city,scenarios}.json                 synthetic dataset (regenerate: python scripts/generate_city.py)
backend/tests/                                         unit + API tests
frontend/src/{views,components,store.tsx,api}          React + TypeScript UI
```

## API (all under `/api`, interactive docs at `/docs`)

`GET health` · `GET config` · `GET scenario` · `GET scenarios` · `POST scenarios/{id}/activate` ·
`PUT scenario/conditions` · `GET zones|roads|shelters` · `POST risk/calculate` · `POST roads/{id}/block|reopen` ·
`POST routes/evacuation` · `POST simulation/reset` · `GET events`

Each browser gets its own isolated simulation through the `X-Session-Id` header, so several visitors can use a
public demo without interfering. State is in memory: a restart or free-tier sleep resets everything to baseline.

## Move the city on the map
The network is drawn at an arbitrary anchor. Edit `ANCHOR_LAT/ANCHOR_LNG` in `scripts/generate_city.py`, run it,
and restart the API. The roads shown are fictional wherever you put them.

See `DEPLOYMENT.md` to publish on free hosting and `DEMO_SCRIPT.md` for a 5-minute walkthrough.
