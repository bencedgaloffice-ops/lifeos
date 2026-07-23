/**
 * Road-following waypoint polylines for the LifeOS vehicle simulation.
 *
 * IMPORTANT — these are hand-authored from real highway geography (the M0
 * ring, M7 towards Balaton/Somogy, M1 towards Győr/Hegyeshalom), not a live
 * pull from OpenStreetMap/OSRM: this sandbox's egress policy blocks both
 * router.project-osrm.org and overpass-api.de (confirmed 403 at the proxy),
 * so no live routing API was reachable. The bend points below follow the
 * real corridors closely enough that the vehicle turns the way the actual
 * roads do, but treat them as a stylized approximation, not surveyed data.
 * Swapping in a real routing/tracking source later only means replacing the
 * `path` arrays here — everything downstream (lib/vehicle-sim.ts, the 3D
 * scene) just consumes points, it doesn't care where they came from.
 */

export type LonLat = [number, number];

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
  // Diósd south along the M7 towards the Balaton shore, then down to Somogy/Kaposvár.
  "diosd-somogy": [
    [18.868, 47.394],
    [18.6, 47.2],
    [18.3, 47.0],
    [18.0525, 46.9057],
    [17.9, 46.65],
    [17.797, 46.359],
  ],
  // Same M7 corridor, stopping at the Balaton shore (Siófok).
  "diosd-balaton": [
    [18.868, 47.394],
    [18.6, 47.2],
    [18.3, 47.0],
    [18.0525, 46.9057],
  ],
  // Diósd west via the M0 ring, then the M1 through Tatabánya and Győr to the Hegyeshalom crossing — the route toward Germany.
  "diosd-germany": [
    [18.868, 47.394],
    [18.75, 47.45],
    [18.4, 47.58],
    [17.87, 47.66],
    [17.65, 47.687],
    [17.13, 47.914],
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
