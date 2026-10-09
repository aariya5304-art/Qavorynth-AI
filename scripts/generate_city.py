"""Generate the synthetic demonstration city ("Halden Basin") used by Qavorynth AI.

The output (backend/app/data/city.json) is a FICTIONAL road network laid over an
arbitrary map anchor. It does not describe real roads, elevations, populations or
shelters. Run:  python scripts/generate_city.py
Everything is deterministic (seeded) so the dataset can be regenerated exactly.
"""
import json
import math
import random
from pathlib import Path

ANCHOR_LAT, ANCHOR_LNG = 21.1000, 79.0000   # arbitrary anchor; change to move the city
STEP = 0.006                                  # degrees between intersections (~650 m)
ROWS, COLS = 5, 6

# Node elevation (m above the river datum). Rows run north -> south, columns west -> east.
ELEV = [
    [32, 31, 30, 29, 28, 27],
    [24, 23, 22, 21, 19, 18],
    [12, 11, 10, 9, 9, 10],
    [5, 4, 3, 2, 3, 4],
    [3, 2, 1, 1, 2, 3],
]

# Zones are rectangles in node-grid units: (row0, col0, row1, col1)
ZONES = [
    ("Z01", "North Ridge", (0, 0, 1, 2), 6200, 0.15, 0.95),
    ("Z02", "Hillcrest Heights", (0, 2, 1, 5), 4100, 0.10, 0.90),
    ("Z03", "Old Market", (1, 0, 3, 2), 14500, 0.60, 1.10),
    ("Z04", "Civic Centre", (1, 2, 3, 4), 9800, 0.40, 1.00),
    ("Z05", "Eastgate", (1, 4, 3, 5), 7400, 0.30, 1.05),
    ("Z06", "Riverside Flats", (3, 0, 4, 2), 11200, 0.95, 1.00),
    ("Z07", "Delta Docks", (3, 2, 4, 4), 5600, 1.00, 1.15),
    ("Z08", "Eastbank", (3, 4, 4, 5), 8300, 0.90, 0.95),
]

# (id, name, kind, node(row, col), capacity, baseline occupancy, step_free)
FACILITIES = [
    ("S1", "North Ridge School Shelter", "shelter", (0, 1), 400, 60, True),
    ("S2", "Hillcrest Community Hall", "shelter", (0, 4), 250, 40, False),
    ("S3", "Civic Centre Arena", "shelter", (2, 3), 900, 150, True),
    ("S4", "Old Market Hall", "shelter", (2, 1), 300, 70, True),
    ("S5", "Eastgate Sports Hall", "shelter", (1, 5), 350, 30, True),
    ("S6", "Riverside Parish Hall", "shelter", (4, 0), 120, 20, False),
    ("H1", "Halden General Hospital (demo)", "hospital", (1, 2), 220, 140, True),
    ("H2", "Eastbank Clinic (demo)", "hospital", (3, 5), 60, 35, True),
]

# Raised embankment roads: (col, row_from, row_to) -> fixed road elevation in metres
RAISED = {(0, 2, 3): 8.5, (0, 3, 4): 8.5, (5, 2, 3): 7.0, (5, 3, 4): 7.0}


def nid(r, c):
    return f"N{r}{c}"


def haversine_m(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def coord(r, c):
    return (round(ANCHOR_LAT - r * STEP, 6), round(ANCHOR_LNG + c * STEP, 6))


def zone_of(r, c):
    for zid, _n, (r0, c0, r1, c1), *_ in ZONES:
        if r0 <= r <= r1 and c0 <= c <= c1:
            return zid
    return ZONES[0][0]


def main():
    rng = random.Random(7)
    nodes = []
    for r in range(ROWS):
        for c in range(COLS):
            lat, lng = coord(r, c)
            nodes.append({"id": nid(r, c), "label": f"{chr(65 + r)}{c + 1}", "lat": lat, "lng": lng,
                          "elevation_m": ELEV[r][c], "zone_id": zone_of(r, c)})
    node_by_id = {n["id"]: n for n in nodes}

    roads = []

    def add_road(r1, c1, r2, c2, name, road_class, raised=None):
        a, b = node_by_id[nid(r1, c1)], node_by_id[nid(r2, c2)]
        dist = round(haversine_m((a["lat"], a["lng"]), (b["lat"], b["lng"])), 1)
        elev = raised if raised is not None else min(a["elevation_m"], b["elevation_m"])
        mid_r, mid_c = (r1 + r2) / 2, (c1 + c2) / 2
        zid = next((z[0] for z in ZONES if z[2][0] <= mid_r <= z[2][2] and z[2][1] <= mid_c <= z[2][3]), "Z01")
        step_free = True if road_class == "arterial" else rng.random() > 0.2
        roads.append({"id": f"R{len(roads) + 1:03d}", "name": name, "a": a["id"], "b": b["id"],
                      "distance_m": dist, "road_class": road_class, "elevation_m": float(elev),
                      "raised": raised is not None, "step_free": step_free, "zone_id": zid})

    for r in range(ROWS):
        for c in range(COLS - 1):
            arterial = r in (1, 2)
            add_road(r, c, r, c + 1, f"Street {chr(65 + r)} ({c + 1}-{c + 2})", "arterial" if arterial else "local")
    for c in range(COLS):
        for r in range(ROWS - 1):
            raised = RAISED.get((c, r, r + 1))
            if c == 0:
                name, cls = f"West Causeway ({r + 1}-{r + 2})", "arterial"
            elif c == COLS - 1:
                name, cls = f"East Embankment Rd ({r + 1}-{r + 2})", "arterial"
            else:
                name, cls = f"Avenue {c + 1} ({r + 1}-{r + 2})", "local"
            add_road(r, c, r + 1, c, name, cls, raised)

    zones = []
    for zid, name, (r0, c0, r1, c1), pop, prox, rain_factor in ZONES:
        corners = [coord(r0, c0), coord(r0, c1), coord(r1, c1), coord(r1, c0)]
        h = haversine_m(coord(r0, c0), coord(r1, c0))
        w = haversine_m(coord(r0, c0), coord(r0, c1))
        area = round(h * w / 1e6, 3)
        in_rect = [ELEV[r][c] for r in range(r0, r1 + 1) for c in range(c0, c1 + 1)]
        cr, cc = (r0 + r1) // 2, (c0 + c1) // 2
        zones.append({"id": zid, "name": name, "polygon": [list(p) for p in corners], "population": pop,
                      "area_km2": area, "mean_elevation_m": round(sum(in_rect) / len(in_rect), 2),
                      "river_proximity": prox, "rain_factor": rain_factor, "anchor_node": nid(cr, cc)})

    facilities = [{"id": i, "name": n, "kind": k, "node_id": nid(*rc), "capacity": cap,
                   "baseline_occupancy": occ, "step_free": sf,
                   "elevation_m": float(ELEV[rc[0]][rc[1]])} for i, n, k, rc, cap, occ, sf in FACILITIES]

    city = {
        "name": "Halden Basin",
        "disclaimer": ("Synthetic demonstration city. Roads, zones, elevations, populations and shelters are "
                       "fictional and are NOT real places, official data or safety guidance."),
        "anchor": {"lat": ANCHOR_LAT, "lng": ANCHOR_LNG}, "rows": ROWS, "cols": COLS,
        "nodes": nodes, "roads": roads, "zones": zones, "facilities": facilities,
    }
    out = Path(__file__).resolve().parent.parent / "backend" / "app" / "data" / "city.json"
    out.write_text(json.dumps(city, indent=1))
    print(f"wrote {out}: {len(nodes)} nodes, {len(roads)} roads, {len(zones)} zones, {len(facilities)} facilities")


if __name__ == "__main__":
    main()
