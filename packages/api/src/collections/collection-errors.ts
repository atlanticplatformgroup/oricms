export class CollectionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CollectionValidationError';
  }
}

export class StaleEntryRevisionError extends Error {
  constructor(
    public readonly entryId: string,
    public readonly currentRevision: string,
  ) {
    super(`Entry '${entryId}' changed since it was opened`);
    this.name = 'StaleEntryRevisionError';
  }
}
