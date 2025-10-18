import mongoose from 'mongoose';

import { config } from './config';

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  connectCount: number;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalWithMongoose.mongooseCache ?? {
  conn: null,
  promise: null,
  connectCount: 0,
};

if (!globalWithMongoose.mongooseCache) {
  globalWithMongoose.mongooseCache = cache;
}

export const dbConnect = async (): Promise<typeof mongoose> => {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(config.database.uri, { dbName: config.database.name })
      .then((connection) => {
        cache.conn = connection;
        cache.connectCount += 1;
        return connection;
      });
  }

  try {
    return await cache.promise;
  } catch (error) {
    cache.promise = null;
    cache.conn = null;
    throw error;
  }
};

export const getConnectionMetrics = () => ({
  connectCount: cache.connectCount,
  hasConnection: cache.conn !== null,
  readyState: cache.conn?.connection.readyState ?? mongoose.connection.readyState,
});

export default dbConnect;
