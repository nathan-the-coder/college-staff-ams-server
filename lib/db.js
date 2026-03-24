const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://nate_dev:Cx9ar20EjXBCPcgK@ac-nirte9t-shard-00-00.2xs8x7u.mongodb.net:27017,ac-nirte9t-shard-00-01.2xs8x7u.mongodb.net:27017,ac-nirte9t-shard-00-02.2xs8x7u.mongodb.net:27017/?ssl=true&replicaSet=atlas-10dx3g-shard-0&authSource=admin&appName=Cluster0";

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

module.exports = dbConnect;
