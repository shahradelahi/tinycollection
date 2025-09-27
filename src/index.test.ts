import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DuplicateIdError, InvalidDocumentError } from './errors';
import { Collection, createCollection } from './index';
import { Document } from './typings';

interface TestDoc extends Document {
  name?: string;
  age?: number;
  tags?: string[];
  nested?: { a: number };
  scores?: any[];
  updated?: string | number;
  fullName?: string;
}

describe('createCollection', () => {
  test('should create a new collection', () => {
    const collection = createCollection();
    expect(collection).toBeDefined();
    expect(collection).toBeInstanceOf(Collection);
  });

  test('should create a collection with initial data', async () => {
    const initialData = [{ name: 'test1' }, { name: 'test2' }];
    const collection = createCollection({ initialData });
    const result = await collection.find().toArray();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('test1');
  });
});

describe('Collection', () => {
  let collection: Collection<TestDoc>;

  beforeEach(() => {
    collection = createCollection();
  });

  describe('Insert', () => {
    test('insertOne should add a document and return it with an _id', async () => {
      const result = await collection.insertOne({ name: 'test' });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('_id');
      expect(result[0].name).toBe('test');
    });

    test('insertOne should throw InvalidDocumentError for non-object documents', async () => {
      // @ts-expect-error TS2559: Type "string" has no properties in common with type
      await expect(collection.insertOne('string')).rejects.toThrow(InvalidDocumentError);
    });

    test('insertOne should throw DuplicateIdError for a document with a duplicate _id', async () => {
      await collection.insertOne({ _id: '1', name: 'test1' });
      await expect(collection.insertOne({ _id: '1', name: 'test2' })).rejects.toThrow(
        DuplicateIdError
      );
    });

    test('insertMany should add multiple documents', async () => {
      const result = await collection.insertMany([{ name: 'test1' }, { name: 'test2' }]);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test1');
      expect(result[1].name).toBe('test2');
      const count = await collection.count();
      expect(count).toBe(2);
    });

    test('insertMany should skip invalid documents', async () => {
      const result = await collection.insertMany([
        { name: 'test1' },
        'invalid',
        { name: 'test2' },
      ] as any);
      expect(result).toHaveLength(2);
      const count = await collection.count();
      expect(count).toBe(2);
    });
  });

  describe('Find & Count', () => {
    beforeEach(async () => {
      await collection.insertMany([
        { name: 'Alice', age: 30, tags: ['a', 'b'] },
        { name: 'Bob', age: 40, tags: ['b', 'c'], nested: { a: 1 } },
        { name: 'Charlie', age: 40, tags: ['c', 'd'] },
      ]);
    });

    test('find with empty query should return all documents', async () => {
      const result = await collection.find().toArray();
      expect(result).toHaveLength(3);
    });

    test('count with empty query should return total count', async () => {
      const result = await collection.count();
      expect(result).toBe(3);
    });

    test('find with a simple query should return matching documents', async () => {
      const result = await collection.find({ name: 'Alice' }).toArray();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice');
    });

    test('count with a simple query should return matching count', async () => {
      const result = await collection.count({ name: 'Alice' });
      expect(result).toBe(1);
    });

    test('find with include projection', async () => {
      const result = await collection.find({ name: 'Alice' }, { name: 1 }).toArray();
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('_id');
      expect(result[0]).not.toHaveProperty('age');
    });

    test('find with exclude projection', async () => {
      const result = await collection.find({ name: 'Alice' }, { age: 0, tags: 0 }).toArray();
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('_id');
      expect(result[0]).not.toHaveProperty('age');
      expect(result[0]).not.toHaveProperty('tags');
    });

    test('find with exclude _id projection', async () => {
      const result = await collection.find({ name: 'Alice' }, { _id: 0, name: 1 }).toArray();
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).not.toHaveProperty('_id');
    });

    test('findOne should return a single document or null', async () => {
      const alice = await collection.findOne({ name: 'Alice' });
      expect(alice).not.toBeNull();
      expect(alice!.name).toBe('Alice');

      const nonExistent = await collection.findOne({ name: 'Eve' });
      expect(nonExistent).toBeNull();
    });
  });

  describe('Cursor Methods', () => {
    beforeEach(async () => {
      await collection.insertMany([
        { name: 'A', age: 10 },
        { name: 'B', age: 20 },
        { name: 'C', age: 30 },
        { name: 'D', age: 40 },
        { name: 'E', age: 50 },
      ]);
    });

    test('skip should ignore the specified number of documents', async () => {
      const result = await collection.find().skip(2).toArray();
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('C');
    });

    test('limit should restrict the number of documents returned', async () => {
      const result = await collection.find().limit(2).toArray();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('A');
      expect(result[1].name).toBe('B');
    });

    test('skip and limit should work together', async () => {
      const result = await collection.find().skip(1).limit(2).toArray();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('B');
      expect(result[1].name).toBe('C');
    });

    test('sort, skip, and limit should work together', async () => {
      const result = await collection.find().sort({ age: -1 }).skip(1).limit(2).toArray();
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('D');
      expect(result[1].name).toBe('C');
    });
  });

  describe('Update', () => {
    beforeEach(async () => {
      await collection.insertMany([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 40 },
        { name: 'Charlie', age: 40 },
      ]);
    });

    test('updateOne with $set should modify a single document', async () => {
      const result = await collection.updateOne({ name: 'Alice' }, { $set: { age: 31 } });
      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(31);
      const doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(31);
    });

    test('updateOne with $inc should increment a field', async () => {
      await collection.updateOne({ name: 'Alice' }, { $inc: { age: 2 } });
      const doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(32);
    });

    test('updateOne with $unset should remove a field', async () => {
      await collection.updateOne({ name: 'Alice' }, { $unset: { age: '' } });
      const doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0]).not.toHaveProperty('age');
    });

    test('updateOne should replace the document if no operator is used', async () => {
      const result = await collection.updateOne({ name: 'Alice' }, { name: 'Alicia' });
      expect(result[0].name).toBe('Alicia');
      expect(result[0]).not.toHaveProperty('age');
      const oldDoc = await collection.find({ name: 'Alice' }).toArray();
      expect(oldDoc).toHaveLength(0);
      const newDoc = await collection.find({ name: 'Alicia' }).toArray();
      expect(newDoc).toHaveLength(1);
    });

    test('updateMany should modify multiple documents', async () => {
      const result = await collection.updateMany({ age: 40 }, { $set: { age: 41 } });
      expect(result).toHaveLength(2);
      const docs = await collection.find({ age: 41 }).toArray();
      expect(docs).toHaveLength(2);
    });

    test('updateOne with $mul should multiply a field', async () => {
      await collection.updateOne({ name: 'Alice' }, { $mul: { age: 2 } });
      const doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(60);
    });

    test('updateOne with $rename should rename a field', async () => {
      await collection.updateOne({ name: 'Alice' }, { $rename: { name: 'fullName' } });
      const doc = await collection.find({ fullName: 'Alice' }).toArray();
      expect(doc).toHaveLength(1);
      expect(doc[0]).not.toHaveProperty('name');
      expect(doc[0]).toHaveProperty('fullName', 'Alice');
    });

    test('updateOne with $min should set field to minimum value', async () => {
      await collection.updateOne({ name: 'Alice' }, { $min: { age: 25 } });
      let doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(25);
      await collection.updateOne({ name: 'Alice' }, { $min: { age: 35 } });
      doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(25); // Should not change
    });

    test('updateOne with $max should set field to maximum value', async () => {
      await collection.updateOne({ name: 'Alice' }, { $max: { age: 35 } });
      let doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(35);
      await collection.updateOne({ name: 'Alice' }, { $max: { age: 25 } });
      doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].age).toBe(35); // Should not change
    });

    test('updateOne with $currentDate should set date', async () => {
      vi.useFakeTimers();
      const date = new Date();
      vi.setSystemTime(date);
      await collection.updateOne({ name: 'Alice' }, { $currentDate: { updated: true } });
      const doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].updated).toBe(date.toISOString());
      vi.useRealTimers();
    });

    test('updateOne with $currentDate timestamp should set timestamp', async () => {
      vi.useFakeTimers();
      const date = new Date();
      vi.setSystemTime(date);
      await collection.updateOne(
        { name: 'Alice' },
        { $currentDate: { updated: { $type: 'timestamp' } } }
      );
      const doc = await collection.find({ name: 'Alice' }).toArray();
      expect(doc[0].updated).toBe(date.getTime());
      vi.useRealTimers();
    });
  });

  describe('Update - Array Operators', () => {
    beforeEach(async () => {
      collection = createCollection();
      await collection.insertMany([
        { name: 'A', tags: ['a', 'b', 'c'], scores: [10, 20, 30] },
        { name: 'B', tags: ['b', 'd'], scores: [{ v: 1 }, { v: 2 }] },
      ]);
    });

    test('$pop should remove last element from array', async () => {
      await collection.updateOne({ name: 'A' }, { $pop: { tags: 1 } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'b']);
    });

    test('$pop should remove first element from array', async () => {
      await collection.updateOne({ name: 'A' }, { $pop: { tags: -1 } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['b', 'c']);
    });

    test('$pull should remove values from array', async () => {
      await collection.updateOne({ name: 'A' }, { $pull: { tags: 'b' } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'c']);
    });

    test('$pull should remove values based on condition', async () => {
      await collection.updateOne({ name: 'A' }, { $pull: { scores: { $gte: 20 } } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].scores).toEqual([10]);
    });

    test('$pull should remove objects from array', async () => {
      await collection.updateOne({ name: 'B' }, { $pull: { scores: { v: 1 } } });
      const doc = await collection.find({ name: 'B' }).toArray();
      expect(doc[0].scores).toEqual([{ v: 2 }]);
    });

    test('$pull should remove values based on a complex condition', async () => {
      await collection.insertOne({
        name: 'C',
        scores: [
          { v: 5, a: 1 },
          { v: 10, a: 2 },
          { v: 15, a: 1 },
        ],
      });
      await collection.updateOne({ name: 'C' }, { $pull: { scores: { v: { $gte: 10 }, a: 1 } } });
      const doc = await collection.find({ name: 'C' }).toArray();
      expect(doc[0].scores).toEqual([
        { v: 5, a: 1 },
        { v: 10, a: 2 },
      ]);
    });

    test('$pullAll should remove multiple values from array', async () => {
      await collection.updateOne({ name: 'A' }, { $pullAll: { tags: ['a', 'c'] } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['b']);
    });

    test('$push should add value to array', async () => {
      await collection.updateOne({ name: 'A' }, { $push: { tags: 'd' } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'b', 'c', 'd']);
    });

    test('$push with $each should add multiple values', async () => {
      await collection.updateOne({ name: 'A' }, { $push: { tags: { $each: ['d', 'e'] } } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    test('$push with $each and $position', async () => {
      await collection.updateOne(
        { name: 'A' },
        { $push: { tags: { $each: ['x', 'y'], $position: 1 } } }
      );
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'x', 'y', 'b', 'c']);
    });

    test('$push with $each and $slice', async () => {
      await collection.updateOne(
        { name: 'A' },
        { $push: { scores: { $each: [40, 50], $slice: -3 } } }
      );
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].scores).toEqual([30, 40, 50]);
    });

    test('$addToSet should add a unique value to an array', async () => {
      await collection.updateOne({ name: 'A' }, { $addToSet: { tags: 'd' } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'b', 'c', 'd']);
    });

    test('$addToSet should not add a duplicate value', async () => {
      await collection.updateOne({ name: 'A' }, { $addToSet: { tags: 'b' } });
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'b', 'c']);
    });

    test('$addToSet with $each should add multiple unique values', async () => {
      await collection.updateOne(
        { name: 'A' },
        { $addToSet: { tags: { $each: ['c', 'd', 'e'] } } }
      );
      const doc = await collection.find({ name: 'A' }).toArray();
      expect(doc[0].tags).toEqual(['a', 'b', 'c', 'd', 'e']);
    });
  });

  describe('Delete', () => {
    beforeEach(async () => {
      await collection.insertMany([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 40 },
        { name: 'Charlie', age: 40 },
      ]);
    });

    test('deleteOne should remove a single document', async () => {
      const result = await collection.deleteOne({ name: 'Alice' });
      expect(result).toBe(1);
      const count = await collection.count();
      expect(count).toBe(2);
    });

    test('deleteMany should remove multiple documents', async () => {
      const result = await collection.deleteMany({ age: 40 });
      expect(result).toBe(2);
      const count = await collection.count();
      expect(count).toBe(1);
    });
  });

  describe('Events', () => {
    test('should emit "insert" event', async () => {
      const listener = vi.fn();
      collection.on('insert', listener);
      await collection.insertOne({ name: 'test' });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0][0].name).toBe('test');
    });

    test('should emit "update" event', async () => {
      await collection.insertOne({ name: 'test' });
      const listener = vi.fn();
      collection.on('update', listener);
      await collection.updateOne({ name: 'test' }, { $set: { name: 'updated' } });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0][0].name).toBe('updated');
    });

    test('should emit "delete" event', async () => {
      await collection.insertOne({ name: 'test' });
      const listener = vi.fn();
      collection.on('delete', listener);
      await collection.deleteOne({ name: 'test' });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0][0].name).toBe('test');
    });

    test('should emit "change" event on all modifications', async () => {
      const listener = vi.fn();
      collection.on('change', listener);
      await collection.insertOne({ name: 'test' });
      await collection.updateOne({ name: 'test' }, { $set: { name: 'updated' } });
      await collection.deleteOne({ name: 'updated' });
      expect(listener).toHaveBeenCalledTimes(3);
    });

    test('one should only fire once', async () => {
      const listener = vi.fn();
      collection.one('insert', listener);
      await collection.insertOne({ name: 'test1' });
      await collection.insertOne({ name: 'test2' });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('off should remove a listener', async () => {
      const listener = vi.fn();
      collection.on('insert', listener);
      collection.off('insert', listener);
      await collection.insertOne({ name: 'test' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('insertOne should throw InvalidDocumentError for non-object', async () => {
      // @ts-expect-error TS2559: Type 123 has no properties in common with type
      await expect(collection.insertOne(123)).rejects.toThrow(InvalidDocumentError);
    });

    test('insertOne should throw DuplicateIdError for duplicate _id', async () => {
      await collection.insertOne({ _id: 'abc', name: 'test' });
      await expect(collection.insertOne({ _id: 'abc', name: 'test2' })).rejects.toThrow(
        DuplicateIdError
      );
    });
  });

  describe('Update with Upsert', () => {
    beforeEach(async () => {
      await collection.insertMany([{ name: 'Alice', age: 30 }]);
    });

    test('updateOne with upsert:true should update existing document', async () => {
      const result = await collection.updateOne(
        { name: 'Alice' },
        { $set: { age: 31 } },
        { upsert: true }
      );
      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(31);
      const count = await collection.count();
      expect(count).toBe(1);
    });

    test('updateOne with upsert:true should insert new document', async () => {
      const result = await collection.updateOne(
        { name: 'Bob' },
        { $set: { age: 40 } },
        { upsert: true }
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
      expect(result[0].age).toBe(40);
      const count = await collection.count();
      expect(count).toBe(2);
    });

    test('updateMany with upsert:true should insert new document if none match', async () => {
      const result = await collection.updateMany(
        { name: 'Bob' },
        { $set: { age: 40 } },
        { upsert: true }
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Bob');
      const count = await collection.count();
      expect(count).toBe(2);
    });

    test('updateOne with upsert and $setOnInsert should only set on insert', async () => {
      // Test insert
      await collection.updateOne(
        { name: 'Bob' },
        { $set: { age: 40 }, $setOnInsert: { created: true } },
        { upsert: true }
      );
      const bob = await collection.find({ name: 'Bob' }).toArray();
      expect(bob[0].age).toBe(40);
      expect((bob[0] as any).created).toBe(true);

      // Test update
      await collection.updateOne(
        { name: 'Alice' },
        { $set: { age: 31 }, $setOnInsert: { created: true } },
        { upsert: true }
      );
      const alice = await collection.find({ name: 'Alice' }).toArray();
      expect(alice[0].age).toBe(31);
      expect(alice[0]).not.toHaveProperty('created');
    });
  });

  describe('FindOneAndUpdate', () => {
    beforeEach(async () => {
      await collection.insertMany([
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 40 },
      ]);
    });

    test('should update a document and return the original', async () => {
      const result = await collection.findOneAndUpdate({ name: 'Alice' }, { $set: { age: 31 } });
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Alice');
      expect(result!.age).toBe(30); // Original age

      const updatedDoc = await collection.findOne({ name: 'Alice' });
      expect(updatedDoc!.age).toBe(31);
    });

    test('should update a document and return the new one', async () => {
      const result = await collection.findOneAndUpdate(
        { name: 'Alice' },
        { $set: { age: 31 } },
        { returnNewDocument: true }
      );
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Alice');
      expect(result!.age).toBe(31); // New age
    });

    test('should return null if no document matches', async () => {
      const result = await collection.findOneAndUpdate({ name: 'Charlie' }, { $set: { age: 50 } });
      expect(result).toBeNull();
    });

    test('should insert a new document with upsert:true', async () => {
      const result = await collection.findOneAndUpdate(
        { name: 'Charlie' },
        { $set: { age: 50 } },
        { upsert: true, returnNewDocument: true }
      );
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Charlie');
      expect(result!.age).toBe(50);

      const count = await collection.count();
      expect(count).toBe(3);
    });

    test('should return the new document on upsert', async () => {
      const result = await collection.findOneAndUpdate(
        { name: 'Charlie' },
        { $set: { age: 50 } },
        { upsert: true } // returnNewDocument is false by default, but upsert should return the new doc
      );
      expect(result).not.toBeNull();
      expect(result!.name).toBe('Charlie');
      expect(result!.age).toBe(50);
    });

    test('should emit update and change events on update', async () => {
      const updateListener = vi.fn();
      const changeListener = vi.fn();
      collection.on('update', updateListener);
      collection.on('change', changeListener);

      await collection.findOneAndUpdate({ name: 'Alice' }, { $set: { age: 31 } });

      expect(updateListener).toHaveBeenCalledTimes(1);
      expect(updateListener.mock.calls[0][0][0].age).toBe(31);
      expect(changeListener).toHaveBeenCalledTimes(1);
    });

    test('should emit insert and change events on upsert', async () => {
      const insertListener = vi.fn();
      const changeListener = vi.fn();
      collection.on('insert', insertListener);
      collection.on('change', changeListener);

      await collection.findOneAndUpdate(
        { name: 'Charlie' },
        { $set: { age: 50 } },
        { upsert: true }
      );

      expect(insertListener).toHaveBeenCalledTimes(1);
      expect(insertListener.mock.calls[0][0][0].name).toBe('Charlie');
      expect(changeListener).toHaveBeenCalledTimes(1);
    });
  });
});

describe('Indexing', () => {
  let collection: Collection<TestDoc>;

  beforeEach(async () => {
    collection = createCollection<TestDoc>({
      initialData: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 40 },
        { name: 'Charlie', age: 40 },
        { name: 'David', age: 50, nested: { a: 1 } },
      ],
    });
  });

  test('createIndex should build an index on existing data', async () => {
    const collection = createCollection<TestDoc>({
      initialData: [
        { name: 'Alice', age: 30 },
        { name: 'Bob', age: 40 },
        { name: 'Charlie', age: 40 },
        { name: 'David', age: 50, nested: { a: 1 } },
      ],
    });
    await collection.createIndex({ age: 1 });
    const index = collection.getIndexes().get('age');
    expect(index).toBeDefined();
    const bob = await collection.find({ name: 'Bob' }).toArray();
    const charlie = await collection.find({ name: 'Charlie' }).toArray();
    expect(index!.map.get(40)).toEqual([bob[0]._id, charlie[0]._id]);
  });

  test('createIndex should throw on duplicate index creation', async () => {
    await collection.createIndex({ name: 1 });
    await expect(collection.createIndex({ name: 1 })).rejects.toThrow(
      'Index on field "name" already exists.'
    );
  });

  test('createIndex with unique option should throw on duplicate values', async () => {
    await expect(collection.createIndex({ age: 1 }, { unique: true })).rejects.toThrow(
      'Duplicate value for unique index on field "age": 40'
    );
  });

  test('insertOne should throw when violating a unique index', async () => {
    await collection.createIndex({ name: 1 }, { unique: true });
    await expect(collection.insertOne({ name: 'Alice', age: 60 })).rejects.toThrow(
      'Unique index violated on field "name" for value "Alice"'
    );
  });

  test('updateOne should throw when violating a unique index', async () => {
    await collection.createIndex({ name: 1 }, { unique: true });
    await collection.insertOne({ name: 'Eve', age: 20 });
    await expect(
      collection.updateOne({ name: 'Eve' }, { $set: { name: 'Alice' } })
    ).rejects.toThrow('Unique index violated on field "name" for value "Alice"');
  });

  test('Index should be used for find queries', async () => {
    await collection.createIndex({ name: 1 });
    const getResultsSpy = vi.spyOn(collection as any, '_getResults');
    const results = await collection.find({ name: 'Bob' }).toArray();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Bob');
    // Check that the optimized path was taken
    expect(getResultsSpy.mock.results[0].value).toHaveLength(1);
  });

  test('Index should be updated on insertOne', async () => {
    await collection.createIndex({ age: 1 });
    await collection.insertOne({ name: 'Eve', age: 30 });
    const index = collection.getIndexes().get('age');
    expect(index).toBeDefined();
    expect(index!.map.get(30)).toHaveLength(2);
  });

  test('Index should be updated on deleteOne', async () => {
    await collection.createIndex({ age: 1 });
    const bob = await collection.find({ name: 'Bob' }).toArray();
    await collection.deleteOne({ _id: bob[0]._id });
    const index = collection.getIndexes().get('age');
    expect(index).toBeDefined();
    expect(index!.map.get(40)).toHaveLength(1);
  });

  test('Index should be updated on updateOne', async () => {
    await collection.createIndex({ age: 1 });
    await collection.updateOne({ name: 'Alice' }, { $set: { age: 31 } });
    const index = collection.getIndexes().get('age');
    expect(index).toBeDefined();
    expect(index!.map.has(30)).toBe(false);
    expect(index!.map.get(31)).toHaveLength(1);
  });

  test('Index on nested field should work', async () => {
    await collection.createIndex({ 'nested.a': 1 });
    const results = await collection.find({ 'nested.a': 1 }).toArray();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('David');
  });

  test('deleteMany should update index', async () => {
    await collection.createIndex({ age: 1 });
    await collection.deleteMany({ age: 40 });
    const index = collection.getIndexes().get('age');
    expect(index).toBeDefined();
    expect(index!.map.has(40)).toBe(false);
    expect(await collection.count()).toBe(2);
  });
});
