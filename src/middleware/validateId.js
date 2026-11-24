import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

// Rejects a malformed :id with 400 before it reaches a query
export function validateId(req, res, next) {
    if (!mongoose.isObjectIdOrHexString(req.params.id))
        throw new ApiError(400, "Invalid id");
    next();
}
