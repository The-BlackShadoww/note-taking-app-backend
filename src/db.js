import mongoose from "mongoose";

// Build indexes automatically in development only. In production (Vercel sets
// NODE_ENV=production) every cold start would otherwise send createIndex calls;
// there the indexes are built once by `npm run seed` (syncIndexes).
mongoose.set("autoIndex", process.env.NODE_ENV !== "production");

let connecting = null;

// Opens the MongoDB connection once and reuses it afterwards.
// - Locally, server.js calls it before app.listen().
// - On Vercel (serverless) there is no long-running server, so app.js calls it on the
//   first request; later requests in the same warm instance reuse the open connection.
export function connectDB() {
    if (mongoose.connection.readyState === 1) return Promise.resolve();
    connecting ??= mongoose.connect(process.env.MONGODB_URI).catch((err) => {
        connecting = null; // allow a retry on the next request
        throw err;
    });
    return connecting;
}
