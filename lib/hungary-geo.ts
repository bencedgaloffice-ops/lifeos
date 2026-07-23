/**
 * Hungary's national border, simplified to 31 points — sourced from the
 * public-domain world.geo.json country-boundary dataset. Used to shape the
 * Life Map's terrain as a recognizable silhouette of Hungary instead of a
 * generic wavy plate. Coordinates are [longitude, latitude].
 */
export const HUNGARY_BORDER: [number, number][] = [
  [16.202, 46.852], [16.534, 47.496], [16.341, 47.713], [16.904, 47.715],
  [16.980, 48.123], [17.488, 47.867], [17.857, 47.758], [18.697, 47.881],
  [18.777, 48.082], [19.174, 48.111], [19.661, 48.267], [19.769, 48.203],
  [20.239, 48.328], [20.474, 48.563], [20.801, 48.624], [21.872, 48.320],
  [22.086, 48.422], [22.641, 48.150], [22.711, 47.882], [22.100, 47.672],
  [21.627, 46.994], [21.022, 46.316], [20.220, 46.127], [19.596, 46.172],
  [18.830, 45.909], [18.456, 45.759], [17.630, 45.952], [16.883, 46.381],
  [16.565, 46.504], [16.371, 46.841], [16.202, 46.852],
];

/** The visible map area — Hungary plus a margin of neighboring countries,
 * so travel pins (e.g. a trip to Romania) can sit just outside the border. */
export const MAP_BOUNDS = { minLon: 14.8, maxLon: 24.2, minLat: 44.9, maxLat: 49.2 };

const centerLon = (MAP_BOUNDS.minLon + MAP_BOUNDS.maxLon) / 2;
const centerLat = (MAP_BOUNDS.minLat + MAP_BOUNDS.maxLat) / 2;
/** Degrees of longitude cover less ground than degrees of latitude the
 * further from the equator you are — this keeps the silhouette's proportions
 * correct instead of stretching it. */
const lonScale = Math.cos((centerLat * Math.PI) / 180);

/** Projects a [lon, lat] pair onto the local X/Z plane used by the 3D scene,
 * north-up, scaled to fit within `worldSize`. */
export function projectLonLat(lon: number, lat: number, worldSize: number): [number, number] {
  const widthDeg = (MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon) * lonScale;
  const heightDeg = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
  const scale = worldSize / Math.max(widthDeg, heightDeg);
  const x = (lon - centerLon) * lonScale * scale;
  const z = -(lat - centerLat) * scale;
  return [x, z];
}

/** A random [lon, lat] within Hungary's bounding box — used to seed a new
 * location pin before the user drags it to its real spot. */
export function randomHungaryLonLat(): [number, number] {
  const minLon = Math.min(...HUNGARY_BORDER.map((p) => p[0]));
  const maxLon = Math.max(...HUNGARY_BORDER.map((p) => p[0]));
  const minLat = Math.min(...HUNGARY_BORDER.map((p) => p[1]));
  const maxLat = Math.max(...HUNGARY_BORDER.map((p) => p[1]));
  return [minLon + Math.random() * (maxLon - minLon), minLat + Math.random() * (maxLat - minLat)];
}
