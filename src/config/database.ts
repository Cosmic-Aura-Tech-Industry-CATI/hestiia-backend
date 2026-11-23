import mongoose from 'mongoose';
import { ENV } from './env.js';
import { db } from '../shared/config/store.js';

export async function connectDatabase(): Promise<boolean> {
  if (!ENV.MONGODB_URI) {
    console.log('[Database] Operating on resilient persistent local database.');
    return false;
  }

  try {
    await mongoose.connect(ENV.MONGODB_URI, {
      serverSelectionTimeoutMS: 2500,
    });
    console.log('[Database] Successfully connected to MongoDB Atlas / Server:', mongoose.connection.host);
    return true;
  } catch (err: any) {
    console.warn(`[Database] MongoDB connection bypassed (${err?.message || 'Host unreachable'}). Operating on persistent store.`);
    return false;
  }
}

export { db };
export default connectDatabase;
