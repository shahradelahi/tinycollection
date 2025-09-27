import { Geometry, Point, Polygon } from 'geojson';

/**
 * Represents a document in the collection. Must have an optional `_id` field.
 */
export interface Document {
  _id?: string;
  [key: string]: any;
}

/**
 * Options for creating a new collection.
 */
export interface CollectionOptions<T> {
  /**
   * An optional array of documents to populate the collection with.
   */
  initialData?: T[];
}

type Unpacked<T> = T extends (infer U)[] ? U : T;

/**
 * Defines a geospatial query using the `$near` or `$nearSphere` operator.
 */
export type NearQuery = {
  $geometry: Point;
  $maxDistance?: number;
  $minDistance?: number;
};

/**
 * Defines a geospatial query using the `$geoWithin` operator.
 */
export type GeoWithinQuery = {
  $geometry?: Polygon;
  $box?: number[][];
  $polygon?: number[][];
  $center?: [number[], number];
  $centerSphere?: [number[], number];
};

/**
 * Defines a geospatial query using the `$geoIntersects` operator.
 */
export type GeoIntersectsQuery = {
  $geometry: Geometry;
};

/**
 * Defines the query selectors for finding documents.
 */
export type QuerySelector<T> =
  | T
  | {
      $eq?: T;
      $ne?: T;
      $gt?: T;
      $gte?: T;
      $lt?: T;
      $lte?: T;
      $in?: Unpacked<T>[];
      $nin?: Unpacked<T>[];
      $all?: Unpacked<T>[];
      $size?: number;
      $exists?: boolean;
      $not?: QuerySelector<T>;
      $regex?: string | RegExp;
      // Geospatial
      $near?: NearQuery;
      $nearSphere?: NearQuery;
      $geoWithin?: GeoWithinQuery;
      $geoIntersects?: GeoIntersectsQuery;
    };

/**
 * A query object to filter documents in a collection.
 */
export type Query<T> = {
  [P in keyof T]?: QuerySelector<T[P]>;
} & {
  $and?: Query<T>[];
  $or?: Query<T>[];
};

type UpdateOperatorQuery<T> = {
  $set?: Partial<T>;
  $setOnInsert?: Partial<T>;
  $unset?: { [P in keyof T]?: '' | true };
  $inc?: { [P in keyof T]?: number };
  $mul?: { [P in keyof T]?: number };
  $rename?: { [P in keyof T]?: string };
  $min?: { [P in keyof T]?: number };
  $max?: { [P in keyof T]?: number };
  $currentDate?: { [P in keyof T]?: true | { $type: 'timestamp' | 'date' } };
  $pop?: { [P in keyof T]?: 1 | -1 };
  $pull?: { [P in keyof T]?: any | QuerySelector<any> };
  $pullAll?: { [P in keyof T]?: any[] };
  $push?: { [P in keyof T]?: any | { $each?: any[]; $slice?: number; $position?: number } };
  $addToSet?: { [P in keyof T]?: any | { $each?: any[] } };
};

/**
 * An update query object for modifying documents.
 * Can be a set of update operators or a replacement document.
 */
export type UpdateQuery<T> = UpdateOperatorQuery<T> | Partial<T>;

/**
 * Options for update operations.
 */
export interface UpdateOptions {
  /**
   * If true, creates a new document if no document matches the filter.
   */
  upsert?: boolean;
}

/**
 * Options for findOneAndUpdate operation.
 */
export interface FindOneAndUpdateOptions extends UpdateOptions {
  /**
   * When true, returns the modified document rather than the original. Defaults to false.
   */
  returnNewDocument?: boolean;
}

/**
 * A projection object to include or exclude fields from a query result.
 * `{ field: 1 }` to include, `{ field: 0 }` to exclude.
 */
export type Projection<T> = {
  [P in keyof T]?: 1 | 0;
};

/**
 * A sort specifier object to define the sorting order of a query result.
 * `{ field: 1 }` for ascending, `{ field: -1 }` for descending.
 */
export type SortSpecifier<T> = {
  [P in keyof T]?: 1 | -1;
};

/**
 * An index specification object.
 * e.g., `{ fieldName: 1 }`
 */
export type IndexSpec<T> = {
  [P in keyof T]?: 1;
};

/**
 * Options for creating an index.
 */
export interface IndexOptions {
  /**
   * If true, enforces that all values for the indexed field are unique.
   */
  unique?: boolean;
}

/**
 * A listener function for collection events.
 */
export type Listener = (data: any) => void;
