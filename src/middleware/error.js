import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

// Any /api request that no route matched
export function notFound(req, res, next) {
    next(
        new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`),
    );
}

// Express recognises an error handler by its 4 parameters, so keep `next` even though it's unused
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
    if (err instanceof mongoose.Error.ValidationError) {
        const message = Object.values(err.errors)
            .map((e) => e.message)
            .join(", ");
        return res.status(400).json({ error: message });
    }
    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ error: `Invalid value for ${err.path}` });
    }
    if (err.code === 11000) {
        // unique index violation (our only unique index is email)
        return res.status(409).json({ error: "Email is already registered" });
    }
    const status = err.status ?? 500; // ApiError, and body-parser errors such as invalid JSON (400)
    if (status >= 500) console.error(err); // log the details on the server...
    res.status(status).json({
        error: status >= 500 ? "Internal server error" : err.message,
    }); // ...never send them to the client
}
