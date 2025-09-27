# tinycollection

[![CI](https://github.com/shahradelahi/tinycollection/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/shahradelahi/tinycollection/actions/workflows/ci.yml)
[![NPM Version](https://img.shields.io/npm/v/tinycollection.svg)](https://www.npmjs.com/package/tinycollection)
[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat)](/LICENSE)
[![Install Size](https://packagephobia.com/badge?p=tinycollection)](https://packagephobia.com/result?p=tinycollection)

_`tinycollection`_ is a tiny, in-memory, MongoDB-like database for Node.js and modern browsers, written in TypeScript. It features a modern toolchain, an enhanced API, and a powerful indexing engine.

It manages documents just like a MongoDB collection, providing a flexible API to insert, update, delete, and find documents. It's perfect for managing data directly within your Web App or for small to medium-sized Node.js applications.

---

- [Features](#-features)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Advanced Features](#-advanced-features)
- [Query Operators](#-query-operators)
- [Update Operators](#-update-operators)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#license)

## ✨ Features

- **Modern TypeScript API**: Fully typed and easy to use.
- **MongoDB-like API**: `find`, `insertOne`, `updateMany`, etc.
- **Powerful Querying**: Rich query operators (`$gt`, `$in`, `$or`, etc.).
- **Indexing Engine**: Create indexes on fields for significantly faster queries, including unique indexes.
- **Cursor Methods**: Chainable `.sort()`, `.skip()`, and `.limit()` for powerful pagination and ordering.
- **Built-in Events**: `on`, `one`, `off` for `insert`, `update`, `delete`, and `change` events.
- **Zero Dependencies**: Lightweight and easy to integrate.

## 📦 Installation

```bash
npm install tinycollection
```

<details>
<summary>Install using your favorite package manager</summary>

**pnpm**

```bash
pnpm install tinycollection
```

**yarn**

```bash
yarn add tinycollection
```

**browser**

```html
<script type="module">
  import tinycollection from 'https://cdn.jsdelivr.net/npm/tinycollection@latest/+esm';
</script>
```

</details>

## 🚀 Quick Start

### Documents

A document is a standard JavaScript object, similar to JSON. When a document is inserted, it automatically gets a unique `_id` string of 16 characters.

<!-- prettier-ignore -->
```javascript
{
  _id: 'atpl4rqu8tzkt9',
  name: { first: 'John', last: 'Doe' },
  email: 'john@doe.com'
}
```

### Create a Collection

```javascript
import { createCollection } from 'tinycollection';

// Create an empty collection
const collection = createCollection();

// Or create with initial data
const initialData = [{ name: 'Alice' }, { name: 'Bob' }];
const users = createCollection({ initialData });
```

### Async/Await API

All data manipulation methods are asynchronous and return Promises, making them perfect for `async/await`.

```javascript
async function main() {
  const users = createCollection();

  // Insert a document
  const [alice] = await users.insertOne({ name: 'Alice', age: 30 });
  console.log(alice);

  // Find documents
  const allUsers = await users.find().toArray();
  console.log(allUsers);
}

main();
```

### Insert Documents

`tinycollection` provides two methods for inserting documents.

To insert a single document:

```javascript
// The result is an array containing the inserted document with its unique _id.
const [doc] = await collection.insertOne({ a: 1 });
```

To insert multiple documents:

```javascript
// The result is an array of the inserted documents with their unique _ids.
const docs = await collection.insertMany([{ a: 1 }, { a: 2, b: 2 }]);
```

### Update Documents

`tinycollection` provides three methods for updating documents.

To update the first document that matches a query:

```javascript
// The result is an array containing the updated document.
const [doc] = await collection.updateOne({ a: 1 }, { $set: { c: 'aaa' } });
```

To update a single document and retrieve it:

```javascript
// Find a document and update it, returning the original document by default.
const originalDoc = await collection.findOneAndUpdate(
  { a: 1 },
  { $set: { c: 'aaa' } }
);

// To return the new, updated document, use the `returnNewDocument` option.
const updatedDoc = await collection.findOneAndUpdate(
  { a: 1 },
  { $set: { c: 'bbb' } },
  { returnNewDocument: true }
);
```

To update all documents that match a query:

```javascript
// The result is an array of the updated documents.
const docs = await collection.updateMany(
  { a: { $gt: 1 } },
  { $set: { c: 'aaa' } }
);
```

### Delete Documents

`tinycollection` provides two methods for deleting documents.

To delete the first document that matches a query:

```javascript
// The result is the number of deleted documents (0 or 1).
const count = await collection.deleteOne({ a: 1 });
```

To delete all documents that match a query:

```javascript
// The result is the number of deleted documents.
const count = await collection.deleteMany({ a: 1 });
```

### Find Documents

The `.find()` method returns a chainable cursor that you can refine with `sort`, `skip`, and `limit`. Call `.toArray()` to execute the query and get the results.

```javascript
// Get all documents
const allDocs = await collection.find().toArray();

// Get documents matching a query
const docs = await collection.find({ a: 1 }).toArray();

// Get documents, sorted by age descending
const sortedDocs = await collection.find({ a: 1 }).sort({ age: -1 }).toArray();

// Paginate results
const page2 = await collection.find().skip(10).limit(10).toArray();
```

To find a single document:

```javascript
// Get the first document matching a query, or null if none is found.
const doc = await collection.findOne({ a: 1 });
```

To count documents:

```javascript
// Get the total number of documents in the collection.
const total = await collection.count();

// Get the number of documents matching a query.
const count = await collection.count({ a: 1 });
```

#### Projecting Fields

You can select which fields to include or exclude from the results.

```javascript
// Include only the 'name' and 'email' fields (_id is included by default)
const docs = await collection.find({}, { name: 1, email: 1 }).toArray();

// Exclude the 'age' field
const docsWithoutAge = await collection.find({}, { age: 0 }).toArray();

// Exclude _id
const docsWithoutId = await collection.find({}, { _id: 0, name: 1 }).toArray();
```

## 🛠️ Advanced Features

### Indexing

For significantly faster queries, you can create an index on a field. Indexes are especially useful for fields that you query frequently.

```javascript
// Create an index on the 'age' field
await collection.createIndex({ age: 1 });

// Create a unique index to enforce that all values for 'email' are unique
await collection.createIndex({ email: 1 }, { unique: true });
```

### Events

Listen for changes in the collection.

- `insert`: Fired when documents are inserted.
- `update`: Fired when documents are updated.
- `delete`: Fired when documents are deleted.
- `change`: Fired for any of the above operations.

```javascript
collection.on('change', (changedDocs) => {
  console.log('Documents changed:', changedDocs);
});

collection.on('insert', (insertedDocs) => {
  console.log('Documents inserted:', insertedDocs);
});

// Fires only once
collection.one('update', (updatedDocs) => {
  console.log('First update:', updatedDocs);
});
```

## 🔍 Query Operators

### Comparison

| Operator | Description                                                         |
| :------- | :------------------------------------------------------------------ |
| `$eq`    | Matches values that are equal to a specified value.                 |
| `$ne`    | Matches all values that are not equal to a specified value.         |
| `$gt`    | Matches values that are greater than a specified value.             |
| `$gte`   | Matches values that are greater than or equal to a specified value. |
| `$lt`    | Matches values that are less than a specified value.                |
| `$lte`   | Matches values that are less than or equal to a specified value.    |
| `$in`    | Matches any of the values specified in an array.                    |
| `$nin`   | Matches none of the values specified in an array.                   |

### Logical

| Operator | Description                               |
| :------- | :---------------------------------------- |
| `$and`   | Joins query clauses with a logical AND.   |
| `$or`    | Joins query clauses with a logical OR.    |
| `$not`   | Inverts the effect of a query expression. |

### Element

| Operator  | Description                                      |
| :-------- | :----------------------------------------------- |
| `$exists` | Matches documents that have the specified field. |

### Evaluation

| Operator | Description                                                          |
| :------- | :------------------------------------------------------------------- |
| `$regex` | Selects documents where values match a specified regular expression. |

### Array

| Operator | Description                                                      |
| :------- | :--------------------------------------------------------------- |
| `$all`   | Matches arrays that contain all elements specified in the query. |
| `$size`  | Selects documents if the array field is a specified size.        |

### Geospatial

| Operator                | Description                                                                                             |
| :---------------------- | :------------------------------------------------------------------------------------------------------ |
| `$geoWithin`            | Selects geometries within a bounding GeoJSON geometry (`$box`, `$polygon`, `$center`, `$centerSphere`). |
| `$geoIntersects`        | Selects geometries that intersect with a GeoJSON geometry.                                              |
| `$near` / `$nearSphere` | Finds geometries within a certain distance, with optional `$minDistance` and `$maxDistance`.            |

## ✍️ Update Operators

### Field

| Operator       | Description                                                                                 |
| :------------- | :------------------------------------------------------------------------------------------ |
| `$set`         | Sets the value of a field in a document.                                                    |
| `$unset`       | Removes the specified field from a document.                                                |
| `$inc`         | Increments the value of the field by the specified amount.                                  |
| `$mul`         | Multiplies the value of the field by the specified amount.                                  |
| `$rename`      | Renames a field.                                                                            |
| `$min`         | Only updates the field if the specified value is less than the existing field value.        |
| `$max`         | Only updates the field if the specified value is greater than the existing field value.     |
| `$currentDate` | Sets the value of a field to the current date, either as an ISO string or a Unix timestamp. |

### Array

| Operator    | Description                                                                                       |
| :---------- | :------------------------------------------------------------------------------------------------ |
| `$addToSet` | Adds elements to an array only if they do not already exist in the set. Can be used with `$each`. |
| `$pop`      | Removes the first or last item of an array.                                                       |
| `$pull`     | Removes all array elements that match a specified query.                                          |
| `$pullAll`  | Removes all matching values from an array.                                                        |
| `$push`     | Adds an item to an array. Can be used with `$each`, `$slice`, and `$position`.                    |

## 📚 Documentation

For a detailed API reference and all configuration options, please see [the API docs](https://www.jsdocs.io/package/tinycollection).

## 🤝 Contributing

Want to contribute? Awesome! To show your support is to star the project, or to raise issues on [GitHub](https://github.com/shahradelahi/tinycollection)

Thanks again for your support, it is much appreciated! 🙏

## License

[MIT](/LICENSE) © [Shahrad Elahi](https://github.com/shahradelahi) and [contributors](https://github.com/shahradelahi/tinycollection/graphs/contributors).
