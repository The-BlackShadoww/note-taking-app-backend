import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { pick } from "../utils/pick.js";

// The token carries only the user id ("sub" = subject). Role and name are read fresh from the
// database on every request, so a role change or a deleted user takes effect immediately.
function signToken(user) {
    return jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    });
}

// POST /api/auth/register
export async function register(req, res) {
    // 'role' is NOT in the allowed list, so nobody can register as an admin
    const data = pick(req.body, ["name", "email", "password", "interests"]);
    const user = await User.create(data); // validation runs, then the pre('save') hook hashes the password
    res.status(201).json({ token: signToken(user), user }); // toJSON removes the hash
}

// POST /api/auth/login
export async function login(req, res) {
    const { email, password } = req.body ?? {};
    // Type check: blocks NoSQL operator injection such as { "email": { "$ne": null } }
    if (typeof email !== "string" || typeof password !== "string") {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }) // index: email_1
        .select("+password"); // opt back in to the hash, which select:false normally hides

    // Same message whether the email or the password is wrong, so attackers can't tell
    // which emails are registered (this is called "user enumeration")
    if (!user || !(await user.comparePassword(password))) {
        throw new ApiError(401, "Invalid email or password");
    }
    res.json({ token: signToken(user), user });
}
