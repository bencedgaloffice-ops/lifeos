/**
 * Hungary's real motorway network — the M0 Budapest ring plus the M1, M3,
 * M5, and M7 spokes radiating out from it — rendered as visible, labeled
 * roads on the Life Map.
 *
 * IMPORTANT — same disclosed limitation as lib/vehicle-routes.ts: this
 * sandbox's egress policy blocks every OSM/routing host reachable to this
 * agent (router.project-osrm.org, router.osrm.org, the overpass-api.de and
 * kumi.systems/openstreetmap.fr/osm.ch Overpass mirrors, and api.openstreetmap.org
 * itself all returned 403 at the proxy — confirmed again when this file was
 * written). raw.githubusercontent.com is reachable, but no ready-made Hungary
 * motorway GeoJSON turned up there. So these polylines are hand-authored from
 * real highway geography (the M0 ring's actual junctions, and the real towns
 * each spoke passes through — Tatabánya/Győr on the M1, Hatvan/Füzesabony on
 * the M3, Kecskemét on the M5, Székesfehérvár/Siófok on the M7) rather than
 * surveyed coordinates. Treat them as a stylized, recognizable approximation,
 * not GPS-accurate data. Swapping in real road geometry later only means
 * replacing the arrays below — the rendering and the vehicle routes that
 * reference these points don't care where they came from.
 */

export type LonLat = [number, number];

export type Road = {
  key: string;
  label: string;
  path: LonLat[];
};

/** The M0 ring itself, closed loop around Budapest — junction points other
 * spokes branch off from. */
export const M0_RING: LonLat[] = [
  [19.06, 47.62],
  [19.25, 47.55],
  [19.3, 47.42],
  [19.15, 47.32],
  [18.9, 47.35],
  [18.8, 47.5],
  [18.9, 47.62],
  [19.06, 47.62],
];

export const ROADS: Road[] = [
  { key: "M0", label: "M0", path: M0_RING },
  {
    key: "M1",
    label: "M1",
    // Budapest (M0 west junction) → Tatabánya → Győr → Mosonmagyaróvár → Hegyeshalom (Austria border)
    path: [
      [18.8, 47.5],
      [18.4, 47.58],
      [17.87, 47.66],
      [17.65, 47.687],
      [17.13, 47.914],
    ],
  },
  {
    key: "M3",
    label: "M3",
    // Budapest (M0 north junction) → Hatvan → Füzesabony → Polgár → Nyíregyháza (towards Ukraine)
    path: [
      [19.06, 47.62],
      [19.4, 47.65],
      [20.0, 47.72],
      [20.6, 47.7],
      [21.72, 47.95],
    ],
  },
  {
    key: "M5",
    label: "M5",
    // Budapest (M0 south junction) → Kecskemét → Kiskunfélegyháza → Szeged (towards Serbia)
    path: [
      [19.15, 47.32],
      [19.5, 47.1],
      [19.69, 46.9],
      [20.0, 46.68],
      [20.15, 46.25],
    ],
  },
  {
    key: "M7",
    label: "M7",
    // Budapest (M0 south junction) → Székesfehérvár → Siófok (Balaton) → Nagykanizsa (towards Croatia)
    path: [
      [19.15, 47.32],
      [18.6, 47.2],
      [18.3, 47.0],
      [18.0525, 46.9057],
      [17.9, 46.65],
      [17.0, 46.45],
    ],
  },
];
