export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6371000;
const METERS_PER_MILE = 1609.34;
const DEG_TO_RAD = Math.PI / 180;

/** Basic haversine distance in miles between two coordinates. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG_TO_RAD;
  const dLng = (b.lng - a.lng) * DEG_TO_RAD;
  const lat1 = a.lat * DEG_TO_RAD;
  const lat2 = b.lat * DEG_TO_RAD;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const distanceM = 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(Math.max(0, h)));
  return distanceM / METERS_PER_MILE;
}

/** Precompute cumulative miles along a route polyline. */
export function buildRouteMetrics(path: LatLng[]) {
  const cumulativeMiles: number[] = [0];
  let total = 0;

  for (let i = 1; i < path.length; i++) {
    const segmentMiles = haversineMiles(path[i - 1], path[i]);
    total += segmentMiles;
    cumulativeMiles.push(total);
  }

  return { cumulativeMiles, totalMiles: total };
}

/**
 * Project a point onto the nearest segment of a path (planar approximation),
 * returning the closest distance in miles and distance traveled along the path.
 */
export function projectPointToRoute(
  path: LatLng[],
  cumulativeMiles: number[],
  point: LatLng
) {
  if (path.length < 2) {
    return {
      distanceToRouteMiles: Infinity,
      routeDistanceMiles: 0,
      segmentIndex: 0,
      projectedPoint: path[0] ?? point,
    };
  }

  let bestDistanceM = Infinity;
  let bestRouteDistanceMiles = 0;
  let bestIndex = 0;
  let bestProjected: LatLng = path[0];

  for (let i = 1; i < path.length; i++) {
    const start = path[i - 1];
    const end = path[i];

    // Approximate meters-per-degree for this segment
    const meanLatRad = ((start.lat + end.lat) / 2) * DEG_TO_RAD;
    const mPerDegLat = 111132;
    const mPerDegLng = 111320 * Math.cos(meanLatRad);

    const ax = start.lng * mPerDegLng;
    const ay = start.lat * mPerDegLat;
    const bx = end.lng * mPerDegLng;
    const by = end.lat * mPerDegLat;
    const px = point.lng * mPerDegLng;
    const py = point.lat * mPerDegLat;

    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;

    const segmentLenSq = vx * vx + vy * vy;
    const t = segmentLenSq === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / segmentLenSq));

    const projX = ax + t * vx;
    const projY = ay + t * vy;

    const dx = px - projX;
    const dy = py - projY;
    const distanceM = Math.sqrt(dx * dx + dy * dy);

    if (distanceM < bestDistanceM) {
      bestDistanceM = distanceM;
      const segmentMiles =
        Math.sqrt(vx * vx + vy * vy) / METERS_PER_MILE;
      bestRouteDistanceMiles =
        (cumulativeMiles[i - 1] ?? 0) + segmentMiles * t;
      bestIndex = i - 1;
      bestProjected = {
        lat: projY / mPerDegLat,
        lng: projX / mPerDegLng,
      };
    }
  }

  return {
    distanceToRouteMiles: bestDistanceM / METERS_PER_MILE,
    routeDistanceMiles: bestRouteDistanceMiles,
    segmentIndex: bestIndex,
    projectedPoint: bestProjected,
  };
}
