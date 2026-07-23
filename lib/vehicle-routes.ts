/**
 * Road-following waypoint polylines for the LifeOS vehicle simulation.
 *
 * IMPORTANT — hand-authored from real highway geography, not a live pull
 * from OpenStreetMap/OSRM: this sandbox's egress policy blocks every
 * routing/OSM host reachable to this agent (router.project-osrm.org,
 * router.osrm.org, several Overpass mirrors, api.openstreetmap.org — all
 * confirmed 403 at the proxy). The M0/M1/M7 legs below share their bend
 * points with the labeled roads drawn in lib/hungary-roads.ts, so the
 * vehicle visibly rides the same line rendered on the map, not a path that
 * merely resembles it. Treat the geometry as a stylized approximation, not
 * surveyed data. Swapping in a real routing/tracking source later only
 * means replacing the `path` arrays here — everything downstream
 * (lib/vehicle-sim.ts, the 3D scene) just consumes points.
 */

import { ROADS } from "./hungary-roads";

export type LonLat = [number, number];

const M1 = ROADS.find((r) => r.key === "M1")!.path;
const M7 = ROADS.find((r) => r.key === "M7")!.path;

export const ROUTES: Record<string, LonLat[]> = {
  // Diósd — just southwest of Budapest — to the ICSB work site, via the M0 ring's western arc into the city.
  "diosd-icsb": [
    [18.868, 47.394],
    [18.93, 47.415],
    [18.99, 47.45],
    [19.02, 47.478],
    [19.04, 47.498],
  ],
  // Diósd to central Budapest — the same M0→city corridor, a shorter hop.
  "diosd-budapest": [
    [18.868, 47.394],
    [18.93, 47.415],
    [18.985, 47.448],
    [19.0402, 47.4979],
  ],
  // Diósd to the M0's south junction, then the M7 exactly as drawn — through
  // Székesfehérvár, along the Balaton shore, down to Somogy/Kaposvár.
  "diosd-somogy": [
    [18.868, 47.394],
    [18.9, 47.35],
    ...M7,
    [17.797, 46.359],
  ],
  // Same M0→M7 corridor, stopping at the Balaton shore (Siófok) instead of continuing to Somogy.
  "diosd-balaton": [
    [18.868, 47.394],
    [18.9, 47.35],
    ...M7.slice(0, M7.findIndex(([lon, lat]) => lon === 18.0525 && lat === 46.9057) + 1),
  ],
  // Diósd to the M0's west junction, then the M1 exactly as drawn — through
  // Tatabánya and Győr to the Hegyeshalom crossing — the route toward Germany.
  "diosd-germany": [
    [18.868, 47.394],
    ...M1,
  ],
};

const centerLat = 47.1;
const lonScale = Math.cos((centerLat * Math.PI) / 180);
const KM_PER_DEGREE_LAT = 111.32;

/** Approximate real-world length of a route, in kilometers. */
export function routeLengthKm(routeKey: string): number {
  const path = ROUTES[routeKey];
  if (!path) return 0;
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    const [lon1, lat1] = path[i - 1];
    const [lon2, lat2] = path[i];
    const dx = (lon2 - lon1) * lonScale * KM_PER_DEGREE_LAT;
    const dy = (lat2 - lat1) * KM_PER_DEGREE_LAT;
    km += Math.sqrt(dx * dx + dy * dy);
  }
  return km;
}

/** Interpolates a [lon, lat] point at `t` (0..1) along a route's total length
 * (arc-length parameterized, so movement speed is visually consistent even
 * though segments have different lengths). */
export function pointAlongRoute(routeKey: string, t: number): LonLat {
  const path = ROUTES[routeKey];
  if (!path || path.length === 0) return [0, 0];
  if (path.length === 1) return path[0];

  const segLengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [lon1, lat1] = path[i - 1];
    const [lon2, lat2] = path[i];
    const dx = (lon2 - lon1) * lonScale;
    const dy = lat2 - lat1;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    total += len;
  }

  const target = Math.max(0, Math.min(1, t)) * total;
  let cursor = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (cursor + segLen >= target || i === segLengths.length - 1) {
      const localT = segLen > 0 ? (target - cursor) / segLen : 0;
      const [lon1, lat1] = path[i];
      const [lon2, lat2] = path[i + 1];
      return [lon1 + (lon2 - lon1) * localT, lat1 + (lat2 - lat1) * localT];
    }
    cursor += segLen;
  }
  return path[path.length - 1];
}
