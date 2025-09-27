import type { Geometry, Point, Polygon } from 'geojson';

import type { GeoIntersectsQuery, GeoWithinQuery } from './typings';

// Earth radius in meters
const EARTH_RADIUS = 6371e3;

/**
 * Calculates the distance between two points on Earth using the Law of Cosines.
 * This is generally accurate for distances greater than a few dozen meters.
 * @param p1 - Point 1
 * @param p2 - Point 2
 * @returns Distance in meters
 */
export function distance(p1: Point, p2: Point): number {
  const lon1 = p1.coordinates[0];
  const lon2 = p2.coordinates[0];
  const lat1 = p1.coordinates[1] * (Math.PI / 180);
  const lat2 = p2.coordinates[1] * (Math.PI / 180);
  const deltaLon = (lon2 - lon1) * (Math.PI / 180);

  return (
    Math.acos(
      Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(deltaLon)
    ) * EARTH_RADIUS
  );
}

/**
 * Checks if a point is inside a polygon using the ray-casting algorithm.
 * @param point - The point to check
 * @param polygon - The polygon (must be a closed linear ring)
 * @returns True if the point is inside
 */
export function isPointInPolygon(point: Point, polygon: number[][]): boolean {
  const x = point.coordinates[0];
  const y = point.coordinates[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

function getAllCoordinates(geometry: Geometry): number[][] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'LineString':
    case 'MultiPoint':
      return geometry.coordinates;
    case 'Polygon':
    case 'MultiLineString':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

export function geoWithin(geometry: Geometry, query: GeoWithinQuery): boolean {
  const points = getAllCoordinates(geometry);
  if (points.length === 0) {
    return false;
  }

  if (query.$box) {
    const [[x1, y1], [x2, y2]] = query.$box;
    const boxPolygon: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [x1, y1],
          [x2, y1],
          [x2, y2],
          [x1, y2],
          [x1, y1],
        ],
      ],
    };
    return points.every((p) =>
      isPointInPolygon({ type: 'Point', coordinates: p }, boxPolygon.coordinates[0])
    );
  }

  if (query.$geometry?.type === 'Polygon') {
    // For now, we only check the outer ring
    return points.every((p) =>
      isPointInPolygon({ type: 'Point', coordinates: p }, query.$geometry!.coordinates[0])
    );
  }

  if (query.$polygon) {
    const polygon: Polygon = {
      type: 'Polygon',
      coordinates: [query.$polygon],
    };
    return points.every((p) =>
      isPointInPolygon({ type: 'Point', coordinates: p }, polygon.coordinates[0])
    );
  }

  if (query.$center) {
    if (geometry.type !== 'Point') return false; // $center only supports Point
    const [center, radius] = query.$center;
    const d = Math.sqrt(
      (center[0] - geometry.coordinates[0]) ** 2 + (center[1] - geometry.coordinates[1]) ** 2
    );
    return d < radius;
  }

  if (query.$centerSphere) {
    if (geometry.type !== 'Point') return false; // $centerSphere only supports Point
    const [centerCoords, radius] = query.$centerSphere;
    const centerPoint: Point = { type: 'Point', coordinates: centerCoords };
    const d = distance(geometry, centerPoint);
    return d < radius;
  }

  return false;
}

export function geoIntersects(
  geometry: Point | { type: 'LineString'; coordinates: number[][] } | Polygon,
  query: GeoIntersectsQuery
): boolean {
  if (!query.$geometry || query.$geometry.type !== 'Polygon') {
    return false;
  }
  const polygon = (query.$geometry as Polygon).coordinates[0];

  switch (geometry.type) {
    case 'LineString': {
      let hasPointInside = false;
      let hasPointOutside = false;
      for (const coord of geometry.coordinates) {
        const point: Point = { type: 'Point', coordinates: coord };
        if (isPointInPolygon(point, polygon)) {
          hasPointInside = true;
        } else {
          hasPointOutside = true;
        }
        if (hasPointInside && hasPointOutside) {
          return true;
        }
      }
      return false;
    }
    case 'Point':
      return isPointInPolygon(geometry, polygon);
    case 'Polygon': {
      // It's considered an intersection if at least one point of the geometry
      // is inside the query polygon, and at least one point is outside.
      let hasPointInside = false;
      let hasPointOutside = false;
      // We only check the outer ring of the geometry for simplicity, matching `geoWithin`
      const geometryPolygon = geometry.coordinates[0];

      for (const coord of geometryPolygon) {
        const point: Point = { type: 'Point', coordinates: coord };
        if (isPointInPolygon(point, polygon)) {
          hasPointInside = true;
        } else {
          hasPointOutside = true;
        }
        if (hasPointInside && hasPointOutside) {
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}
