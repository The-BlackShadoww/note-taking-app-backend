import express from "express";
import cors from "cors";
import { connectDB } from "./db.js";
import { notFound, errorHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import noteRoutes from "./routes/note.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import postRoutes from "./routes/post.routes.js";

const app = express();

// Only our own frontend may call this API from a browser (study guide 02, section 2.1)
const allowedOrigins = (process.env.CLIENT_URL ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "100kb" })); // parse JSON bodies, refuse huge ones

app.get("/", (req, res) =>
    res.json({ name: "Note-taking API", health: "/api/health" }),
);
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Make sure MongoDB is connected before any route below runs (needed on Vercel, where
// server.js never runs; a no-op once connected)
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/posts", postRoutes);

// These two always stay at the bottom, after every route
app.use("/api", notFound);
app.use(errorHandler);

export default app;
