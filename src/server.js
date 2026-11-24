import mongoose from "mongoose";
import app from "./app.js";
import { connectDB } from "./db.js";

const { PORT = 3000 } = process.env;

// Connect first, then listen: never accept requests that can't reach the database
try {
    await connectDB();
    console.log("MongoDB connected:", mongoose.connection.name);
} catch (err) {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
}

app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`));
