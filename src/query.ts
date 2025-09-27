import { distance, geoIntersects, geoWithin } from './geo';
import type { Document, Query } from './typings';
import { deepEqual, get } from './utils';

export class QueryMatcher<T extends Document> {
  constructor(private query: Query<T>) {}

  matches(doc: T): boolean {
    if (this.query.$and) {
      return this.query.$and.every((q) => new QueryMatcher(q).matches(doc));
    }
    if (this.query.$or) {
      return this.query.$or.some((q) => new QueryMatcher(q).matches(doc));
    }

    for (const key in this.query) {
      if (key.startsWith('$')) continue;

      const queryValue = this.query[key as keyof T];
      const docValue = get(doc, key);

      if (!this.valueMatches(queryValue, docValue, doc)) {
        return false;
      }
    }
    return true;
  }

  private valueMatches(queryValue: any, docValue: any, doc: T): boolean {
    if (typeof queryValue === 'object' && queryValue !== null && !Array.isArray(queryValue)) {
      const operator = Object.keys(queryValue)[0];
      if (operator.startsWith('$')) {
        const operand = queryValue[operator];
        switch (operator) {
          case '$eq':
            return deepEqual(docValue, operand);
          case '$ne':
            return !deepEqual(docValue, operand);
          case '$gt':
            return docValue > operand;
          case '$gte':
            return docValue >= operand;
          case '$lt':
            return docValue < operand;
          case '$lte':
            return docValue <= operand;
          case '$in':
            if (!Array.isArray(operand)) return false;
            if (Array.isArray(docValue)) {
              return operand.some((v) => docValue.some((dv) => deepEqual(v, dv)));
            }
            return operand.some((v) => deepEqual(v, docValue));
          case '$nin':
            if (!Array.isArray(operand)) return true;
            if (Array.isArray(docValue)) {
              return !operand.some((v) => docValue.some((dv) => deepEqual(v, dv)));
            }
            return !operand.some((v) => deepEqual(v, docValue));
          case '$all':
            if (!Array.isArray(docValue) || !Array.isArray(operand)) return false;
            return operand.every((v) => docValue.some((dv) => deepEqual(v, dv)));
          case '$size':
            return Array.isArray(docValue) && docValue.length === operand;
          case '$exists':
            return (docValue !== undefined) === !!operand;
          case '$not':
            return !this.valueMatches(operand, docValue, doc);
          case '$regex': {
            if (typeof docValue !== 'string') return false;
            try {
              const regex = operand instanceof RegExp ? operand : new RegExp(operand);
              return regex.test(docValue);
            } catch (e) {
              return false;
            }
          }
          // Geospatial
          case '$near':
          case '$nearSphere':
            if (docValue?.type === 'Point' && operand?.$geometry?.type === 'Point') {
              const dist = distance(docValue, operand.$geometry);
              const max = operand.$maxDistance;
              const min = operand.$minDistance;
              if (max !== undefined && dist > max) return false;
              if (min !== undefined && dist < min) return false;
              return true;
            }
            return false;
          case '$geoWithin':
            if (docValue?.type && operand) {
              return geoWithin(docValue, operand);
            }
            return false;
          case '$geoIntersects':
            if (docValue?.type && operand?.$geometry) {
              return geoIntersects(docValue, operand);
            }
            return false;
          default:
            return deepEqual(queryValue, docValue);
        }
      }
    }
    return deepEqual(queryValue, docValue);
  }
}
