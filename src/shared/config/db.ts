import mongoose from 'mongoose';
import { MONGODB_URI } from './utils.js';
import { db } from './store.js';

export async function connectDB(): Promise<boolean> {
  if (!MONGODB_URI) {
    console.log('[Database] No MONGODB_URI configured. Running in high-performance local persistent store mode.');
    return false;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('[Database] Successfully connected to MongoDB Atlas / Server:', mongoose.connection.host);
    return true;
  } catch (err: any) {
    console.warn(`[Database] MongoDB connection bypassed (${err?.message || 'Host unreachable'}). Operating on persistent local database.`);
    return false;
  }
}

export { db };
export * from './store.js';
export default connectDB;
