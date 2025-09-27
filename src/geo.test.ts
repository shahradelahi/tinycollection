import type { Geometry, LineString, Point, Polygon } from 'geojson';
import { describe, expect, test } from 'vitest';

import { distance, geoIntersects, geoWithin, isPointInPolygon } from './geo';
import { GeoIntersectsQuery, GeoWithinQuery } from './typings';

describe('distance', () => {
  const point1: Point = { type: 'Point', coordinates: [0, 0] };
  const point2: Point = { type: 'Point', coordinates: [0.1, 0.1] };

  test('should return a positive distance for two different points', () => {
    const d = distance(point1, point2);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeCloseTo(15725.33, 2);
  });

  test('should return 0 for the same point', () => {
    expect(distance(point1, point1)).toBe(0);
  });
});

describe('isPointInPolygon', () => {
  const square: number[][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ];
  const insidePoint: Point = { type: 'Point', coordinates: [0.5, 0.5] };
  const outsidePoint: Point = { type: 'Point', coordinates: [1.5, 1.5] };
  const onVertexPoint: Point = { type: 'Point', coordinates: [1, 1] };
  const onEdgePoint: Point = { type: 'Point', coordinates: [0.5, 1] };

  test('should return true for a point inside the polygon', () => {
    expect(isPointInPolygon(insidePoint, square)).toBe(true);
  });

  test('should return false for a point outside the polygon', () => {
    expect(isPointInPolygon(outsidePoint, square)).toBe(false);
  });

  test('should return false for a point on a vertex', () => {
    // Ray-casting can be ambiguous on edges/vertices. The current implementation returns false.
    expect(isPointInPolygon(onVertexPoint, square)).toBe(false);
  });

  test('should return false for a point on a non-horizontal edge', () => {
    // Behavior on edges can vary. This implementation considers points on vertical edges as outside.
    const onEdgePoint: Point = { type: 'Point', coordinates: [1, 0.5] };
    expect(isPointInPolygon(onEdgePoint, square)).toBe(false);
  });

  test('should return false for a point on a horizontal edge', () => {
    expect(isPointInPolygon(onEdgePoint, square)).toBe(false);
  });
});

describe('geoWithin', () => {
  const pointIn: Point = { type: 'Point', coordinates: [0.5, 0.5] };
  const pointOut: Point = { type: 'Point', coordinates: [2, 2] };
  const lineIn: LineString = {
    type: 'LineString',
    coordinates: [
      [0.2, 0.2],
      [0.8, 0.8],
    ],
  };
  const lineOut: LineString = {
    type: 'LineString',
    coordinates: [
      [0.5, 0.5],
      [1.5, 1.5],
    ],
  };
  const polygonIn: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [0.2, 0.2],
        [0.8, 0.2],
        [0.8, 0.8],
        [0.2, 0.8],
        [0.2, 0.2],
      ],
    ],
  };
  const polygonOut: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [0.5, 0.5],
        [1.5, 0.5],
        [1.5, 1.5],
        [0.5, 1.5],
        [0.5, 0.5],
      ],
    ],
  };

  const queryBox: GeoWithinQuery = {
    $box: [
      [0, 0],
      [1, 1],
    ],
  };
  const queryPolygon: GeoWithinQuery = {
    $geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  };

  test('should handle Point with $box', () => {
    expect(geoWithin(pointIn, queryBox)).toBe(true);
    expect(geoWithin(pointOut, queryBox)).toBe(false);
  });

  test('should handle LineString with $box', () => {
    expect(geoWithin(lineIn, queryBox)).toBe(true);
    expect(geoWithin(lineOut, queryBox)).toBe(false);
  });

  test('should handle Polygon with $box', () => {
    expect(geoWithin(polygonIn, queryBox)).toBe(true);
    expect(geoWithin(polygonOut, queryBox)).toBe(false);
  });

  test('should handle Point with $geometry', () => {
    expect(geoWithin(pointIn, queryPolygon)).toBe(true);
    expect(geoWithin(pointOut, queryPolygon)).toBe(false);
  });

  test('should handle Point with $center', () => {
    const query: GeoWithinQuery = { $center: [[0, 0], 1] };
    const point1: Point = { type: 'Point', coordinates: [0.5, 0.5] };
    const point2: Point = { type: 'Point', coordinates: [1, 1] };
    expect(geoWithin(point1, query)).toBe(true);
    expect(geoWithin(point2, query)).toBe(false);
  });

  test('should handle Point with $centerSphere', () => {
    const query: GeoWithinQuery = { $centerSphere: [[0, 0], 16000] }; // 16km
    const point1: Point = { type: 'Point', coordinates: [0.1, 0.1] };
    const point2: Point = { type: 'Point', coordinates: [0.2, 0.2] };
    expect(geoWithin(point1, query)).toBe(true);
    expect(geoWithin(point2, query)).toBe(false);
  });

  test('$center should only work with Point geometries', () => {
    const query: GeoWithinQuery = { $center: [[0, 0], 1] };
    expect(geoWithin(lineIn, query)).toBe(false);
  });

  test('should handle MultiPoint with $box', () => {
    const multiPointIn: Geometry = {
      type: 'MultiPoint',
      coordinates: [
        [0.2, 0.2],
        [0.8, 0.8],
      ],
    };
    const multiPointOut: Geometry = {
      type: 'MultiPoint',
      coordinates: [
        [0.5, 0.5],
        [1.5, 1.5],
      ],
    };
    expect(geoWithin(multiPointIn, queryBox)).toBe(true);
    expect(geoWithin(multiPointOut, queryBox)).toBe(false);
  });

  test('should handle MultiLineString with $box', () => {
    const multiLineIn: Geometry = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0.1, 0.1],
          [0.2, 0.2],
        ],
        [
          [0.8, 0.8],
          [0.9, 0.9],
        ],
      ],
    };
    const multiLineOut: Geometry = {
      type: 'MultiLineString',
      coordinates: [
        [
          [0.1, 0.1],
          [0.2, 0.2],
        ],
        [
          [1.1, 1.1],
          [1.2, 1.2],
        ],
      ],
    };
    expect(geoWithin(multiLineIn, queryBox)).toBe(true);
    expect(geoWithin(multiLineOut, queryBox)).toBe(false);
  });

  test('should handle MultiPolygon with $box', () => {
    const multiPolygonIn: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0.1, 0.1],
            [0.2, 0.1],
            [0.2, 0.2],
            [0.1, 0.2],
            [0.1, 0.1],
          ],
        ],
        [
          [
            [0.8, 0.8],
            [0.9, 0.8],
            [0.9, 0.9],
            [0.8, 0.9],
            [0.8, 0.8],
          ],
        ],
      ],
    };
    const multiPolygonOut: Geometry = {
      type: 'MultiPolygon',
      coordinates: [
        [
          [
            [0.1, 0.1],
            [0.2, 0.1],
            [0.2, 0.2],
            [0.1, 0.2],
            [0.1, 0.1],
          ],
        ],
        [
          [
            [1.8, 1.8],
            [1.9, 1.8],
            [1.9, 1.9],
            [1.8, 1.9],
            [1.8, 1.8],
          ],
        ],
      ],
    };
    expect(geoWithin(multiPolygonIn, queryBox)).toBe(true);
    expect(geoWithin(multiPolygonOut, queryBox)).toBe(false);
  });
});

describe('geoIntersects', () => {
  const queryPolygon: GeoIntersectsQuery = {
    $geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  };

  test('should handle Point intersection', () => {
    const pointIn: Point = { type: 'Point', coordinates: [0.5, 0.5] };
    const pointOut: Point = { type: 'Point', coordinates: [1.5, 1.5] };
    expect(geoIntersects(pointIn, queryPolygon)).toBe(true);
    expect(geoIntersects(pointOut, queryPolygon)).toBe(false);
  });

  test('should handle LineString intersection', () => {
    const lineIntersects: LineString = {
      type: 'LineString',
      coordinates: [
        [0.5, 0.5],
        [1.5, 1.5],
      ],
    };
    const lineInside: LineString = {
      type: 'LineString',
      coordinates: [
        [0.2, 0.2],
        [0.8, 0.8],
      ],
    };
    const lineOutside: LineString = {
      type: 'LineString',
      coordinates: [
        [2, 2],
        [3, 3],
      ],
    };
    expect(geoIntersects(lineIntersects, queryPolygon)).toBe(true);
    expect(geoIntersects(lineInside, queryPolygon)).toBe(false);
    expect(geoIntersects(lineOutside, queryPolygon)).toBe(false);
  });

  test('should handle Polygon intersection', () => {
    const polygonIntersects: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0.5, 0.5],
          [1.5, 0.5],
          [1.5, 1.5],
          [0.5, 1.5],
          [0.5, 0.5],
        ],
      ],
    };
    const polygonInside: Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.8, 0.8],
          [0.2, 0.8],
          [0.2, 0.2],
        ],
      ],
    };
    expect(geoIntersects(polygonIntersects, queryPolygon)).toBe(true);
    expect(geoIntersects(polygonInside, queryPolygon)).toBe(false);
  });
});
