import { describe, expect, test } from 'vitest';

import { QueryMatcher } from './query';
import { Document } from './typings';

interface TestDoc extends Document {
  name: string;
  age?: number;
  tags?: string[];
  nested?: { a: number };
  category?: string;
  score?: number;
  location?: any;
  route?: any;
}

describe('QueryMatcher', () => {
  describe('Basic Operators', () => {
    const doc1: TestDoc = { name: 'Alice', age: 30, tags: ['a', 'b'], nested: { a: 1 } };
    const doc2: TestDoc = { name: 'Bob', age: 40, tags: ['b', 'c'], nested: { a: 2 } };
    const doc3: TestDoc = { name: 'Charlie', age: 40, tags: ['c', 'd'] };

    test('should match a simple query', () => {
      const matcher = new QueryMatcher<TestDoc>({ name: 'Alice' });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });

    test('should handle $eq operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $eq: 40 } });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc2)).toBe(true);
    });

    test('should handle $ne operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ name: { $ne: 'Alice' } });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc2)).toBe(true);
    });

    test('should handle $gt operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $gt: 30 } });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc2)).toBe(true);
    });

    test('should handle $gte operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $gte: 40 } });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc2)).toBe(true);
    });

    test('should handle $lt operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $lt: 40 } });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });

    test('should handle $lte operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $lte: 30 } });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });

    test('should handle $in operator with primitive value', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $in: [30, 40] } });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc2)).toBe(true);
      expect(matcher.matches({ age: 50 } as any)).toBe(false);
    });

    test('should handle $in operator with array value', () => {
      const matcher = new QueryMatcher<TestDoc>({ tags: { $in: ['a', 'd'] } });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc3)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });

    test('should handle $nin operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $nin: [30, 50] } });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc2)).toBe(true);
    });

    test('should handle $exists operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ nested: { $exists: true } });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc3)).toBe(false);
    });

    test('should handle $not operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ age: { $not: { $gt: 35 } } });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });

    test('should match nested object query', () => {
      const matcher = new QueryMatcher<TestDoc>({ 'nested.a': 1 });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });
  });

  describe('Advanced Operators', () => {
    const doc1 = { name: 'Alice', tags: ['a', 'b'], scores: [1, 2, 3] };
    const doc2 = { name: 'Bob', tags: ['b', 'c'], scores: [4, 5] };
    const doc3 = { name: 'Charlie', tags: ['c', 'd'], scores: [6] };

    test('should handle $regex with a string pattern', () => {
      const matcher = new QueryMatcher<TestDoc>({ name: { $regex: 'lic' } });
      expect(matcher.matches(doc1 as any)).toBe(true);
      expect(matcher.matches(doc2 as any)).toBe(false);
    });

    test('should handle $regex with a RegExp object', () => {
      const matcher = new QueryMatcher<TestDoc>({ name: { $regex: /^b/i } });
      expect(matcher.matches(doc1 as any)).toBe(false);
      expect(matcher.matches(doc2 as any)).toBe(true);
    });

    test('should handle $all operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ tags: { $all: ['a', 'b'] } });
      expect(matcher.matches(doc1 as any)).toBe(true);
      expect(matcher.matches(doc2 as any)).toBe(false);
    });

    test('$all should not match if not all elements are present', () => {
      const matcher = new QueryMatcher<TestDoc>({ tags: { $all: ['a', 'c'] } });
      expect(matcher.matches(doc1 as any)).toBe(false);
    });

    test('should handle $size operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ scores: { $size: 3 } });
      expect(matcher.matches(doc1 as any)).toBe(true);
      expect(matcher.matches(doc2 as any)).toBe(false);
      expect(matcher.matches(doc3 as any)).toBe(false);
    });
  });

  describe('Logical Operators', () => {
    const doc1: TestDoc = { name: 'A', category: 'cat1', score: 10 };
    const doc2: TestDoc = { name: 'B', category: 'cat2', score: 10 };
    const doc3: TestDoc = { name: 'C', category: 'cat1', score: 20 };
    const doc4: TestDoc = { name: 'D', category: 'cat2', score: 20 };

    test('should handle $and operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ $and: [{ category: 'cat1' }, { score: 20 }] });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc3)).toBe(true);
    });

    test('should handle $or operator', () => {
      const matcher = new QueryMatcher<TestDoc>({ $or: [{ name: 'A' }, { score: 20 }] });
      expect(matcher.matches(doc1)).toBe(true);
      expect(matcher.matches(doc4)).toBe(true);
      expect(matcher.matches(doc2)).toBe(false);
    });

    test('should handle nested $and and $or operators', () => {
      const matcher = new QueryMatcher<TestDoc>({
        $and: [
          { $or: [{ category: 'cat2' }, { score: 20 }] },
          { $or: [{ name: 'C' }, { name: 'D' }] },
        ],
      });
      expect(matcher.matches(doc1)).toBe(false);
      expect(matcher.matches(doc2)).toBe(false); // (cat2 || score:10) is true, but (name:C || name:D) is false
      expect(matcher.matches(doc3)).toBe(true); // (cat1 || score:20) is true, and (name:C || name:D) is true
      expect(matcher.matches(doc4)).toBe(true); // (cat2 || score:20) is true, and (name:C || name:D) is true
    });

    test('should handle complex $and containing multiple $or clauses', () => {
      const matcher = new QueryMatcher<TestDoc>({
        $and: [
          { $or: [{ name: 'A' }, { name: 'B' }] },
          { $or: [{ category: 'cat1' }, { score: 10 }] },
        ],
      });
      expect(matcher.matches(doc1)).toBe(true); // (A or B) is true AND (cat1 or 10) is true
      expect(matcher.matches(doc2)).toBe(true); // (A or B) is true AND (cat1 or 10) is true
      expect(matcher.matches(doc3)).toBe(false); // (A or B) is false
      expect(matcher.matches(doc4)).toBe(false); // (A or B) is false
    });
  });

  describe('Geospatial Queries', () => {
    const centralPark: TestDoc = {
      name: 'Central Park',
      location: { type: 'Point', coordinates: [-73.9654, 40.7829] },
    };
    const timesSquare: TestDoc = {
      name: 'Times Square',
      location: { type: 'Point', coordinates: [-73.9855, 40.758] },
    };
    const statueOfLiberty: TestDoc = {
      name: 'Statue of Liberty',
      location: { type: 'Point', coordinates: [-74.0445, 40.6892] },
    };

    test('$near should find points within a max distance', () => {
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [-73.9855, 40.758] },
            $maxDistance: 2000, // 2km
          },
        },
      });
      expect(matcher.matches(timesSquare)).toBe(true);
      expect(matcher.matches(centralPark)).toBe(false);
    });

    test('$near should respect $minDistance', () => {
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates: [-73.9855, 40.758] },
            $maxDistance: 3500,
            $minDistance: 1000,
          },
        },
      });
      expect(matcher.matches(centralPark)).toBe(true);
      expect(matcher.matches(timesSquare)).toBe(false);
    });

    test('$nearSphere should behave like $near', () => {
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [-73.9855, 40.758] },
            $maxDistance: 2000,
          },
        },
      });
      expect(matcher.matches(timesSquare)).toBe(true);
      expect(matcher.matches(centralPark)).toBe(false);
    });

    test('$geoWithin a $box', () => {
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $geoWithin: {
            $box: [
              [-74.0, 40.7],
              [-73.9, 40.8],
            ],
          },
        },
      });
      expect(matcher.matches(centralPark)).toBe(true);
      expect(matcher.matches(timesSquare)).toBe(true);
      expect(matcher.matches(statueOfLiberty)).toBe(false);
    });

    test('$geoWithin a $geometry polygon', () => {
      const polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      };
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $geoWithin: {
            $geometry: polygon,
          },
        },
      });
      expect(matcher.matches(centralPark)).toBe(true);
      expect(matcher.matches(timesSquare)).toBe(true);
      expect(matcher.matches(statueOfLiberty)).toBe(false);
    });

    test('$geoIntersects with a LineString', () => {
      const polygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      };
      const intersectingRoute: TestDoc = {
        name: 'Intersecting Route',
        route: {
          type: 'LineString',
          coordinates: [
            [-74.05, 40.75],
            [-73.95, 40.75],
          ],
        },
      };
      const containedRoute: TestDoc = {
        name: 'Contained Route',
        route: {
          type: 'LineString',
          coordinates: [
            [-73.98, 40.75],
            [-73.95, 40.75],
          ],
        },
      };
      const matcher = new QueryMatcher<TestDoc>({
        route: {
          $geoIntersects: {
            $geometry: polygon,
          },
        },
      });
      expect(matcher.matches(intersectingRoute)).toBe(true);
      expect(matcher.matches(containedRoute)).toBe(false); // Not intersecting, but contained
    });
  });

  describe('Geospatial Queries with various shapes', () => {
    const manhattanPolygon: TestDoc = {
      name: 'Manhattan',
      location: {
        type: 'Polygon',
        coordinates: [
          [
            [-74.0, 40.7],
            [-73.9, 40.7],
            [-73.9, 40.8],
            [-74.0, 40.8],
            [-74.0, 40.7],
          ],
        ],
      },
    };
    const broadwayLine: TestDoc = {
      name: 'Broadway',
      location: {
        type: 'LineString',
        coordinates: [
          [-73.9855, 40.758], // Times Square
          [-73.9654, 40.7829], // Near Central Park
        ],
      },
    };
    const outsideLine: TestDoc = {
      name: 'Outside Line',
      location: {
        type: 'LineString',
        coordinates: [
          [-74.1, 40.9],
          [-74.2, 40.9],
        ],
      },
    };

    test('$geoWithin should match a LineString completely inside a $box', () => {
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $geoWithin: {
            $box: [
              [-74.0, 40.7],
              [-73.9, 40.8],
            ],
          },
        },
      });
      expect(matcher.matches(broadwayLine)).toBe(true);
      expect(matcher.matches(outsideLine)).toBe(false);
    });

    test('$geoWithin should match a Polygon completely inside a $geometry', () => {
      const biggerPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.8, 40.6],
            [-73.8, 40.9],
            [-74.1, 40.9],
            [-74.1, 40.6],
          ],
        ],
      };
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $geoWithin: {
            $geometry: biggerPolygon,
          },
        },
      });
      expect(matcher.matches(manhattanPolygon)).toBe(true);
    });

    test('$geoWithin should not match a partially overlapping Polygon', () => {
      const smallerPolygon = {
        type: 'Polygon',
        coordinates: [
          [
            [-73.95, 40.75],
            [-73.85, 40.75],
            [-73.85, 40.85],
            [-73.95, 40.85],
            [-73.95, 40.75],
          ],
        ],
      };
      const matcher = new QueryMatcher<TestDoc>({
        location: {
          $geoWithin: {
            $geometry: smallerPolygon,
          },
        },
      });
      expect(matcher.matches(manhattanPolygon)).toBe(false);
    });
  });
});
