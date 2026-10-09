# Demo script (about 5 minutes)

Figures below come from the current dataset; they should match exactly after **Reset scenario**.

1. **Overview (baseline).** Point out the amber *Demo environment · synthetic data* tag and the map banner. Metrics:
   8 zones, 0 high-risk, 0 blocked roads, 1,950 free shelter places, 0 alerts. The route panel shows the baseline
   evacuation route from junction E2 (622 m to Riverside Parish Hall).
2. **Risk Map.** Click a zone (Delta Docks) and walk through the component bars and the explanation line. Switch the
   time buttons to **+3 h** and show the *Predicted hotspots* table. State that the model is trained on synthetic data.
3. **Scenario Simulator -> Heavy rainfall, rising water.** One click updates everything: 4 high-risk zones,
   20 flood-unsafe roads, 5 of 6 shelters operating, free capacity 1,350, 9 active alerts. The origin switches to
   junction D1 and the route goes to Old Market Hall (1,290 m) over the raised West Causeway. Open **Event Log** to
   show the recorded effects.
4. **Scenario Simulator -> Critical road closure.** Street E (1-2) closes. The route changes from Riverside Parish
   Hall (622 m) to Old Market Hall (1,334 m); the *Selected route* panel flags the reroute and the before/after table
   shows the deltas.
5. **No-route handling.** In Evacuation Planning pick an origin, then in the simulator block every road around it.
   The panel reports *No route* and explains why. No alternative is invented.
6. **Evacuation Planning.** Toggle *Require step-free*, change mode between fastest and safest, and show the
   *Facilities considered* table with the reason each facility was or was not chosen.
7. **Methodology.** Show weights, normalisation rules, thresholds, routing cost, model validation figures and
   the limitations list.
8. **Reset scenario** returns to the identical baseline.
