import mongoose from "mongoose";

/**
 * The URI is read at CALL time, not at module load.
 *
 * Throwing at import time made any file that transitively imports this module
 * unloadable without a database configured — which is how a missing .env.local
 * surfaced as a stack trace pointing at lib/db.ts from a script that had not
 * tried to connect to anything yet. Deferring the check means the error appears
 * where the connection is actually attempted, and says what to do about it.
 */
function getMongoUri(): string {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      [
        "MONGODB_URI is not set.",
        "",
        "Create a file named exactly `.env.local` in the project root (next to",
        "package.json) containing:",
        "",
        "  MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/zenblue",
        "",
        "On Windows, Notepad saves as `.env.local.txt` unless you pick",
        '"All Files" in the Save dialog — check with `dir .env*` and rename if needed.',
        "The value must not be quoted, and any @ # / or ? in the password must be",
        "URL-encoded (@ becomes %40).",
      ].join("\n")
    );
  }

  return uri;
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development, and across serverless function invocations in production.
 * Without this, each API route call could open a new DB connection.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(getMongoUri(), {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
