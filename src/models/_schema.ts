import { Schema } from 'mongoose';

/**
 * Strip MongoDB internal _id and __v fields from JSON serialization and lean results.
 */
export function applyCleanTransform(schema: Schema) {
  const transform = (_doc: any, ret: Record<string, any>) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  };
  schema.set('toJSON', { virtuals: false, versionKey: false, transform });
  schema.set('toObject', { virtuals: false, versionKey: false, transform });
}

/**
 * Remove _id and __v from lean query objects.
 */
export function cleanDoc<T>(doc: any): T {
  if (!doc || typeof doc !== 'object') return doc;
  const { _id, __v, ...rest } = doc;
  return rest as T;
}

/**
 * Remove _id and __v from arrays of lean query objects.
 */
export function cleanDocs<T>(docs: any[]): T[] {
  return docs.map((d) => cleanDoc<T>(d));
}
