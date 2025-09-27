export class TinyCollectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TinyCollectionError';
  }
}

export class InvalidDocumentError extends TinyCollectionError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidDocumentError';
  }
}

export class DuplicateIdError extends TinyCollectionError {
  constructor(id: string) {
    super(`Document with _id ${id} already exists.`);
    this.name = 'DuplicateIdError';
  }
}
