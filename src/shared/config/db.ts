import mongoose from 'mongoose';
import { MONGODB_URI } from './utils.js';
import { db } from './store.js';

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  if (!MONGODB_URI) {
    console.log('[Database] No MONGODB_URI configured. Running in persistent local store mode.');
    return false;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return true;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[Database] Live connection established to MongoDB Atlas: ${mongoose.connection.host}`);
    return true;
  } catch (err: any) {
    console.warn(`[Database] MongoDB connection bypassed (${err?.message || 'Host unreachable'}). Operating on high-performance local database.`);
    return false;
  }
}

export { db };
export * from './store.js';
export default connectDB;
