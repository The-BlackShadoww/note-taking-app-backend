import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

// Who are you? Verifies the JWT and loads the current user into req.user (401 on failure)
export async function authenticate(req, res, next) {
    // 1. Read "Authorization: Bearer <token>"
    const [scheme, token] = (req.headers.authorization ?? "").split(" ");
    if (scheme !== "Bearer" || !token) {
        throw new ApiError(401, "Missing token");
    }

    // 2. Verify the signature and expiry. Pinning the algorithm blocks "alg" tricks.
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, {
            algorithms: ["HS256"],
        });
    } catch {
        throw new ApiError(401, "Invalid or expired token");
    }

    // 3. Load the current user (index: _id_). The hash is excluded by select:false.
    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, "User no longer exists");

    // Later code reads req.user._id and req.user.role from the DB, not from the token
    req.user = user;
    next();
}

// What may you do? Use after authenticate: authorize("admin") (403 on failure)
export function authorize(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            throw new ApiError(403, "You do not have permission");
        }
        next();
    };
}
