import { DuplicateIdError, InvalidDocumentError } from './errors';
import { QueryMatcher } from './query';
import type {
  CollectionOptions,
  Document,
  FindOneAndUpdateOptions,
  IndexOptions,
  IndexSpec,
  Listener,
  Projection,
  Query,
  SortSpecifier,
  UpdateOptions,
  UpdateQuery,
} from './typings';
import { clone, deepEqual, generateId, get, set, unset } from './utils';

/**
 * A tiny, in-memory, MongoDB-like database collection.
 * @template T The type of document stored in the collection.
 */
export class Collection<T extends Document> {
  #documents: (T & { _id: string })[] = [];
  #documentMap: Map<string, T & { _id: string }> = new Map();
  #indexes: Map<
    string,
    {
      spec: IndexSpec<T>;
      options: IndexOptions;
      map: Map<any, string | string[]>;
    }
  > = new Map();

  #events: Record<string, Listener[]> = {};
  #cursor: {
    query?: Query<T>;
    projection?: Projection<T>;
    sort?: SortSpecifier<T>;
    skip?: number;
    limit?: number;
  } | null = null;

  /**
   * Creates a new Collection instance.
   * @param options - Options for initializing the collection.
   */
  constructor(options?: CollectionOptions<T>) {
    this.#documents = [];
    this.#documentMap = new Map();
    this.#indexes = new Map();
    if (options?.initialData) {
      this.insertManySync(options.initialData);
    }
  }

  // Event Emitter
  /**
   * Registers an event listener.
   * @param eventName - The name of the event to listen for ('insert', 'update', 'delete', 'change').
   * @param listener - The callback function to execute.
   * @returns The collection instance for chaining.
   */
  on(eventName: string, listener: Listener): this {
    if (!this.#events[eventName]) {
      this.#events[eventName] = [];
    }
    this.#events[eventName].push(listener);
    return this;
  }

  /**
   * Removes an event listener.
   * @param eventName - The name of the event.
   * @param listener - The listener to remove.
   * @returns The collection instance for chaining.
   */
  off(eventName: string, listener: Listener): this {
    if (!this.#events[eventName]) return this;
    this.#events[eventName] = this.#events[eventName].filter((l) => l !== listener);
    return this;
  }

  /**
   * Registers a one-time event listener.
   * @param eventName - The name of the event.
   * @param listener - The callback function to execute.
   * @returns The collection instance for chaining.
   */
  one(eventName: string, listener: Listener): this {
    const wrapper = (data: any) => {
      listener(data);
      this.off(eventName, wrapper);
    };
    return this.on(eventName, wrapper);
  }

  /**
   * Emits an event to all registered listeners.
   * @param eventName - The name of the event to emit.
   * @param data - The data to pass to the listeners.
   */
  emit(eventName: string, data: any): void {
    if (!this.#events[eventName]) return;
    this.#events[eventName].forEach((l) => l(data));
  }

  // Public API
  /**
   * Inserts a single document into the collection.
   * @param doc - The document to insert.
   * @returns A promise that resolves to an array containing the inserted document with its `_id`.
   */
  async insertOne(doc: T): Promise<(T & { _id: string })[]> {
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      // Match the sync method's behavior by throwing for invalid doc types.
      throw new InvalidDocumentError('Document must be an object.');
    }
    const newDoc = this.insertOneSync(doc);
    return [newDoc];
  }

  /**
   * Inserts multiple documents into the collection.
   * @param docs - An array of documents to insert.
   * @returns A promise that resolves to an array of the successfully inserted documents.
   */
  async insertMany(docs: T[]): Promise<(T & { _id: string })[]> {
    if (!Array.isArray(docs)) {
      return [];
    }
    return this.insertManySync(docs);
  }

  /**
   * Creates a cursor for a query.
   * @param query - The query object to filter documents.
   * @param projection - The projection object to shape the output.
   * @returns The collection instance with a cursor for chaining.
   */
  find(query: Query<T> = {}, projection?: Projection<T>): this {
    this.#cursor = { query, projection };
    return this;
  }

  /**
   * Sorts the results of the query.
   * @param specifier - The sort specifier object.
   * @returns The collection instance for chaining.
   */
  sort(specifier: SortSpecifier<T>): this {
    if (!this.#cursor) {
      this.find();
    }
    this.#cursor!.sort = specifier;
    return this;
  }

  /**
   * Skips a number of documents in the query result.
   * @param n - The number of documents to skip.
   * @returns The collection instance for chaining.
   */
  skip(n: number): this {
    if (!this.#cursor) {
      this.find();
    }
    this.#cursor!.skip = n;
    return this;
  }

  /**
   * Limits the number of documents returned by the query.
   * @param n - The maximum number of documents to return.
   * @returns The collection instance for chaining.
   */
  limit(n: number): this {
    if (!this.#cursor) {
      this.find();
    }
    this.#cursor!.limit = n;
    return this;
  }

  /**
   * Executes the query and returns the results as an array.
   * @returns A promise that resolves to an array of matching documents.
   */
  async toArray(): Promise<T[]> {
    if (!this.#cursor) {
      this.find();
    }
    const { query, projection, sort, skip, limit } = this.#cursor!;
    this.#cursor = null;

    let results = this._getResults(query!);

    if (sort) {
      results.sort((a, b) => {
        for (const key in sort) {
          const aVal = get(a, key);
          const bVal = get(b, key);
          const direction = sort[key as keyof T]!;

          if (aVal < bVal) return -direction;
          if (aVal > bVal) return direction;
        }
        return 0;
      });
    }

    if (skip) {
      results = results.slice(skip);
    }

    if (limit) {
      results = results.slice(0, limit);
    }

    const projected = this.project(results, projection);
    return clone(projected);
  }

  /**
   * Counts the number of documents matching the query.
   * @param query - The query object to filter documents.
   * @returns A promise that resolves to the number of matching documents.
   */
  async count(query: Query<T> = {}): Promise<number> {
    return this._getResults(query).length;
  }

  /**
   * Finds a single document that matches the filter.
   * @param filter - The query object to select the document to find.
   * @param projection - The projection object to shape the output.
   * @returns A promise that resolves to the found document, or null if no document was found.
   */
  async findOne(filter: Query<T>, projection?: Projection<T>): Promise<T | null> {
    const results = await this.find(filter, projection).limit(1).toArray();
    return results[0] || null;
  }

  /**
   * Finds a single document and updates it.
   * @param filter - The query object to select the document to update.
   * @param update - The update query object.
   * @param options - Options for the operation (e.g., upsert, returnNewDocument).
   * @returns A promise that resolves to the document, or null if no document was found.
   */
  async findOneAndUpdate(
    filter: Query<T>,
    update: UpdateQuery<T>,
    options: FindOneAndUpdateOptions = {}
  ): Promise<(T & { _id: string }) | null> {
    const doc = this._getResults(filter)[0];
    if (doc) {
      const originalDoc = clone(doc);
      const updatedDoc = this.updateDoc(doc, update);
      this.emit('update', [updatedDoc]);
      this.emit('change', [updatedDoc]);
      return options.returnNewDocument ? clone(updatedDoc) : originalDoc;
    }

    if (options.upsert) {
      const [newDoc] = await this._upsert(filter, update);
      return newDoc;
    }

    return null;
  }

  /**
   * Updates a single document that matches the filter.
   * @param filter - The query object to select the document to update.
   * @param update - The update query object.
   * @param options - Options for the update operation (e.g., upsert).
   * @returns A promise that resolves to an array containing the updated document, or an empty array if no document was updated.
   */
  async updateOne(
    filter: Query<T>,
    update: UpdateQuery<T>,
    options: UpdateOptions = {}
  ): Promise<(T & { _id: string })[]> {
    const doc = this._getResults(filter)[0];
    if (doc) {
      const updatedDoc = this.updateDoc(doc, update);
      this.emit('update', [updatedDoc]);
      this.emit('change', [updatedDoc]);
      return [clone(updatedDoc)];
    }

    if (options.upsert) {
      return this._upsert(filter, update);
    }

    return [];
  }

  /**
   * Updates all documents that match the filter.
   * @param filter - The query object to select the documents to update.
   * @param update - The update query object.
   * @param options - Options for the update operation (e.g., upsert).
   * @returns A promise that resolves to an array of the updated documents.
   */
  async updateMany(
    filter: Query<T>,
    update: UpdateQuery<T>,
    options: UpdateOptions = {}
  ): Promise<(T & { _id: string })[]> {
    const docsToUpdate = this._getResults(filter);
    if (docsToUpdate.length > 0) {
      const updatedDocs: (T & { _id: string })[] = [];
      docsToUpdate.forEach((doc) => {
        const updatedDoc = this.updateDoc(doc, update);
        updatedDocs.push(updatedDoc);
      });
      this.emit('update', updatedDocs);
      this.emit('change', updatedDocs);
      return clone(updatedDocs);
    }

    if (options.upsert) {
      return this._upsert(filter, update);
    }

    return [];
  }

  /**
   * Deletes a single document that matches the filter.
   * @param filter - The query object to select the document to delete.
   * @returns A promise that resolves to the number of documents deleted (0 or 1).
   */
  async deleteOne(filter: Query<T>): Promise<number> {
    const docToDelete = this._getResults(filter)[0];
    if (docToDelete) {
      const index = this.#documents.findIndex((doc) => doc._id === docToDelete._id);
      if (index > -1) {
        const [deletedDoc] = this.#documents.splice(index, 1);
        this.#documentMap.delete(deletedDoc._id);
        this._removeFromIndex(deletedDoc);
        this.emit('delete', [deletedDoc]);
        this.emit('change', [deletedDoc]);
        return 1;
      }
    }
    return 0;
  }

  /**
   * Deletes all documents that match the filter.
   * @param filter - The query object to select the documents to delete.
   * @returns A promise that resolves to the number of documents deleted.
   */
  async deleteMany(filter: Query<T>): Promise<number> {
    const docsToDelete = this._getResults(filter);
    if (docsToDelete.length > 0) {
      const idsToDelete = new Set(docsToDelete.map((d) => d._id));
      this.#documents = this.#documents.filter((doc) => !idsToDelete.has(doc._id));
      docsToDelete.forEach((doc) => {
        this.#documentMap.delete(doc._id);
        this._removeFromIndex(doc);
      });
      this.emit('delete', docsToDelete);
      this.emit('change', docsToDelete);
    }
    return docsToDelete.length;
  }

  /**
   * Gets the map of all created indexes.
   * @returns A map of the indexes.
   */
  getIndexes() {
    return this.#indexes;
  }

  /**
   * Creates an index on a field for faster queries.
   * @param spec - The index specification.
   * @param options - Options for the index (e.g., unique).
   * @returns A promise that resolves when the index is created.
   */
  async createIndex(spec: IndexSpec<T>, options: IndexOptions = {}): Promise<void> {
    const field = Object.keys(spec)[0];
    if (!field || Object.keys(spec).length > 1) {
      throw new Error('Index spec must contain exactly one field.');
    }
    if (this.#indexes.has(field)) {
      throw new Error(`Index on field "${field}" already exists.`);
    }

    const map = new Map<any, string | string[]>();
    this.#indexes.set(field, { spec, options, map });

    // Populate index with existing data
    for (const doc of this.#documents) {
      const value = get(doc, field);
      if (value === undefined) continue;

      if (options.unique) {
        if (map.has(value)) {
          // Cleanup partially built index before throwing
          this.#indexes.delete(field);
          throw new Error(`Duplicate value for unique index on field "${field}": ${value}`);
        }
        map.set(value, doc._id);
      } else {
        let entry = map.get(value);
        if (!entry) {
          entry = [];
          map.set(value, entry);
        }
        (entry as string[]).push(doc._id);
      }
    }
  }

  // Private Sync Methods
  private _getResults(query: Query<T>): (T & { _id: string })[] {
    const queryKeys = Object.keys(query);
    let candidateIds: Set<string> | null = null;
    let bestIndexField: string | null = null;

    // Find the best index to use.
    for (const key of queryKeys) {
      if (this.#indexes.has(key)) {
        const queryValue = (query as any)[key];
        if (typeof queryValue === 'string' || typeof queryValue === 'number') {
          bestIndexField = key;
          break;
        }
        if (typeof queryValue === 'object' && queryValue.$eq) {
          bestIndexField = key;
          break;
        }
      }
    }

    // If an index is found, get the candidate documents.
    if (bestIndexField) {
      const index = this.#indexes.get(bestIndexField)!;
      const queryValue = (query as any)[bestIndexField];
      const valueToLookup =
        typeof queryValue === 'object' && queryValue.$eq ? queryValue.$eq : queryValue;

      const ids = index.map.get(valueToLookup);
      if (ids) {
        const idArray = Array.isArray(ids) ? ids : [ids];
        candidateIds = new Set(idArray);
      } else {
        // If the index has no entry for this value, no documents can match.
        return [];
      }
    }

    let candidates: (T & { _id: string })[];
    if (candidateIds) {
      candidates = [];
      for (const id of candidateIds) {
        const doc = this.#documentMap.get(id);
        if (doc) {
          candidates.push(doc);
        }
      }
    } else {
      // No suitable index found, fall back to a full scan.
      candidates = this.#documents;
    }

    // Filter the candidates with the full query.
    return candidates.filter((doc) => new QueryMatcher(query).matches(doc));
  }

  private _addToIndex(doc: T & { _id: string }) {
    for (const [field, index] of this.#indexes.entries()) {
      const value = get(doc, field);
      if (value === undefined) continue;

      if (index.options.unique) {
        if (index.map.has(value)) {
          throw new DuplicateIdError(
            `Unique index violated on field "${field}" for value "${value}"`
          );
        }
        index.map.set(value, doc._id);
      } else {
        let entry = index.map.get(value) as string[];
        if (!entry) {
          entry = [];
          index.map.set(value, entry);
        }
        entry.push(doc._id);
      }
    }
  }

  private _removeFromIndex(doc: T & { _id: string }) {
    for (const [field, index] of this.#indexes.entries()) {
      const value = get(doc, field);
      if (value === undefined) continue;

      if (index.options.unique) {
        if (index.map.get(value) === doc._id) {
          index.map.delete(value);
        }
      } else {
        const entry = index.map.get(value) as string[];
        if (entry) {
          const pos = entry.indexOf(doc._id);
          if (pos > -1) {
            entry.splice(pos, 1);
            if (entry.length === 0) {
              index.map.delete(value);
            }
          }
        }
      }
    }
  }

  private insertOneSync(doc: T): T & { _id: string } {
    if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
      throw new InvalidDocumentError('Document must be an object.');
    }

    // Check for unique index violations before inserting
    for (const [field, index] of this.#indexes.entries()) {
      if (index.options.unique) {
        const value = get(doc, field);
        if (value !== undefined && index.map.has(value)) {
          throw new DuplicateIdError(
            `Unique index violated on field "${field}" for value "${value}"`
          );
        }
      }
    }

    const docToInsert = clone(doc);

    if (docToInsert._id) {
      if (typeof docToInsert._id !== 'string') {
        throw new InvalidDocumentError('_id must be a string.');
      }
      if (!this.isNewId(docToInsert._id)) {
        throw new DuplicateIdError(docToInsert._id);
      }
    } else {
      let id = generateId();
      while (!this.isNewId(id)) {
        id = generateId();
      }
      docToInsert._id = id;
    }

    const newDoc = docToInsert as T & { _id: string };

    this.#documents.push(newDoc);
    this.#documentMap.set(newDoc._id, newDoc);
    this._addToIndex(newDoc); // Add to indexes after pushing to documents

    this.emit('insert', [newDoc]);
    this.emit('change', [newDoc]);
    return clone(newDoc);
  }

  private insertManySync(docs: T[]): (T & { _id: string })[] {
    const insertedDocs: (T & { _id: string })[] = [];
    for (const doc of docs) {
      try {
        // We call the sync method, but we don't need the return value here.
        // insertOneSync will do all the work including emitting events.
        const newDoc = this.insertOneSync(doc);
        insertedDocs.push(newDoc);
      } catch (e) {
        // silent skip for invalid or duplicate docs
      }
    }
    // We can emit a single event for insertMany if needed.
    // For now, we stick to the original behavior inside insertOneSync.
    return insertedDocs;
  }

  private isNewId(id: string): boolean {
    return !this.#documentMap.has(id);
  }

  private project(docs: (T & { _id: string })[], projection?: Projection<T>): T[] {
    if (!projection || Object.keys(projection).length === 0) {
      return docs;
    }

    const isInclude = Object.values(projection).some((v) => v === 1);
    const finalProjection = { ...projection };

    if (isInclude && finalProjection._id !== 0) {
      finalProjection._id = 1;
    }

    return docs.map((doc) => {
      if (isInclude) {
        const projectedDoc: any = {};
        for (const key in finalProjection) {
          if (finalProjection[key as keyof T] === 1) {
            const value = get(doc, key);
            if (value !== undefined) {
              set(projectedDoc, key, value);
            }
          }
        }
        return projectedDoc;
      } else {
        // Exclude
        const docToProject = clone(doc);
        for (const key in finalProjection) {
          if (finalProjection[key as keyof T] === 0) {
            unset(docToProject, key);
          }
        }
        return docToProject;
      }
    });
  }

  private _applyUpdate(doc: T, update: UpdateQuery<T>, isUpsert = false): T {
    const operator = Object.keys(update)[0];

    if (operator.startsWith('$')) {
      // Handle operator-based updates
      for (const op in update) {
        const arg = (update as any)[op];
        switch (op) {
          case '$set':
            for (const key in arg) {
              set(doc, key, clone(arg[key]));
            }
            break;
          case '$setOnInsert':
            if (isUpsert) {
              for (const key in arg) {
                set(doc, key, clone(arg[key]));
              }
            }
            break;
          case '$unset':
            for (const key in arg) {
              unset(doc, key);
            }
            break;
          case '$inc':
            for (const key in arg) {
              const value = get(doc, key);
              set(doc, key, (value || 0) + arg[key]);
            }
            break;
          case '$mul':
            for (const key in arg) {
              const value = get(doc, key);
              set(doc, key, (typeof value === 'number' ? value : 0) * arg[key]);
            }
            break;
          case '$rename':
            for (const key in arg) {
              const value = get(doc, key);
              if (value !== undefined) {
                set(doc, arg[key], value);
                unset(doc, key);
              }
            }
            break;
          case '$min':
            for (const key in arg) {
              const value = get(doc, key);
              if (value === undefined || arg[key] < value) {
                set(doc, key, arg[key]);
              }
            }
            break;
          case '$max':
            for (const key in arg) {
              const value = get(doc, key);
              if (value === undefined || arg[key] > value) {
                set(doc, key, arg[key]);
              }
            }
            break;
          case '$currentDate':
            for (const key in arg) {
              const type = arg[key];
              if (type === true || (type && type.$type === 'date')) {
                set(doc, key, new Date().toISOString());
              } else if (type && type.$type === 'timestamp') {
                set(doc, key, Date.now());
              }
            }
            break;
          case '$pop':
            for (const key in arg) {
              const value = get(doc, key);
              if (Array.isArray(value)) {
                if (arg[key] === 1) value.pop();
                else if (arg[key] === -1) value.shift();
              }
            }
            break;
          case '$pull':
            for (const key in arg) {
              const arr = get(doc, key);
              if (Array.isArray(arr)) {
                const condition = arg[key];
                let filter: (item: any) => boolean;

                if (
                  typeof condition === 'object' &&
                  condition !== null &&
                  !Array.isArray(condition)
                ) {
                  // Condition is an object. It could be a query with operators, or a literal document to match.
                  const isOperatorQuery = Object.keys(condition).some((k) => k.startsWith('$'));

                  if (isOperatorQuery) {
                    // This is for queries like { $in: [1, 2] } or { $gt: 5 } on an array of primitives.
                    const matcher = new QueryMatcher({ value: condition } as any);
                    filter = (item: any) => !matcher.matches({ value: item });
                  } else {
                    // This is for queries on an array of documents, e.g., { field: value, field2: { $gt: 10 } }
                    const matcher = new QueryMatcher(condition as Query<any>);
                    filter = (item: any) => !matcher.matches(item);
                  }
                } else {
                  // Condition is a literal value to match.
                  filter = (item: any) => !deepEqual(item, condition);
                }
                set(doc, key, arr.filter(filter));
              }
            }
            break;
          case '$pullAll':
            for (const key in arg) {
              const arr = get(doc, key);
              if (Array.isArray(arr) && Array.isArray(arg[key])) {
                set(
                  doc,
                  key,
                  arr.filter(
                    (item) => !arg[key].some((removeItem: any) => deepEqual(item, removeItem))
                  )
                );
              }
            }
            break;
          case '$push':
            for (const key in arg) {
              let arr = get(doc, key);
              if (arr === undefined) {
                set(doc, key, []);
                arr = get(doc, key);
              }

              if (Array.isArray(arr)) {
                const pushVal = arg[key];
                if (typeof pushVal === 'object' && pushVal !== null && pushVal.$each) {
                  const toPush = clone(pushVal.$each);
                  const position = pushVal.$position;
                  if (position !== undefined) {
                    arr.splice(position, 0, ...toPush);
                  } else {
                    arr.push(...toPush);
                  }

                  if (pushVal.$slice !== undefined) {
                    let sliced;
                    if (pushVal.$slice > 0) {
                      sliced = arr.slice(0, pushVal.$slice);
                    } else if (pushVal.$slice === 0) {
                      sliced = [];
                    } else {
                      sliced = arr.slice(pushVal.$slice);
                    }
                    set(doc, key, sliced);
                  }
                } else {
                  arr.push(clone(pushVal));
                }
              }
            }
            break;
          case '$addToSet':
            for (const key in arg) {
              let arr = get(doc, key);
              if (arr === undefined) {
                set(doc, key, []);
                arr = get(doc, key);
              }

              if (Array.isArray(arr)) {
                const value = arg[key];
                const toAdd =
                  typeof value === 'object' && value !== null && value.$each
                    ? value.$each
                    : [value];

                for (const item of toAdd) {
                  if (!arr.some((elem) => deepEqual(elem, item))) {
                    arr.push(clone(item));
                  }
                }
              }
            }
            break;
        }
      }
    } else {
      // Replace document
      const _id = (doc as any)._id;
      Object.keys(doc).forEach((key) => {
        if (key !== '_id') {
          delete (doc as any)[key];
        }
      });
      Object.assign(doc, update);
      if (_id) (doc as any)._id = _id;
    }
    return doc;
  }

  private updateDoc(doc: T & { _id: string }, update: UpdateQuery<T>): T & { _id: string } {
    const oldDoc = clone(doc);
    this._applyUpdate(doc, update);

    // Update indexes
    for (const [field, index] of this.#indexes.entries()) {
      const oldValue = get(oldDoc, field);
      const newValue = get(doc, field);

      if (!deepEqual(oldValue, newValue)) {
        // Check for unique constraint violation on the new value
        if (index.options.unique && newValue !== undefined && index.map.has(newValue)) {
          // Revert change and throw error
          Object.assign(doc, oldDoc);
          throw new DuplicateIdError(
            `Unique index violated on field "${field}" for value "${newValue}"`
          );
        }

        // Remove old value from index
        if (oldValue !== undefined) {
          if (index.options.unique) {
            index.map.delete(oldValue);
          } else {
            const entry = index.map.get(oldValue) as string[];
            if (entry) {
              const pos = entry.indexOf(doc._id);
              if (pos > -1) entry.splice(pos, 1);
              if (entry.length === 0) index.map.delete(oldValue);
            }
          }
        }

        // Add new value to index
        if (newValue !== undefined) {
          if (index.options.unique) {
            index.map.set(newValue, doc._id);
          } else {
            let entry = index.map.get(newValue) as string[];
            if (!entry) {
              entry = [];
              index.map.set(newValue, entry);
            }
            entry.push(doc._id);
          }
        }
      }
    }

    return doc;
  }

  private async _upsert(
    filter: Query<T>,
    update: UpdateQuery<T>
  ): Promise<(T & { _id: string })[]> {
    const newDoc = {} as T;
    // Apply equality conditions from filter
    for (const key in filter) {
      if (!key.startsWith('$')) {
        const value = filter[key as keyof T];
        if (typeof value !== 'object' || value === null) {
          set(newDoc, key, value);
        } else if (Object.prototype.hasOwnProperty.call(value, '$eq')) {
          set(newDoc, key, (value as any).$eq);
        }
      }
    }

    this._applyUpdate(newDoc, update, true);
    return this.insertOne(newDoc);
  }
}

/**
 * Creates and returns a new `Collection` instance.
 * @template T The type of document to be stored in the collection.
 * @param options - Options for initializing the collection.
 * @returns A new collection instance.
 */
export function createCollection<T extends Document>(options?: CollectionOptions<T>) {
  return new Collection<T>(options);
}

export type * from './typings';
export type { Geometry, Point, Polygon } from 'geojson';
