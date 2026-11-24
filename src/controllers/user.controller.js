import mongoose from "mongoose";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { pick } from "../utils/pick.js";
import { getPagination, paginated } from "../utils/pagination.js";
import { usersByInterestPipeline, userPostsPipeline } from "../pipelines.js";

// GET /api/users/me
export function getMe(req, res) {
    res.json({ user: req.user }); // loaded by authenticate; toJSON hides the hash
}

// PATCH /api/users/me
export async function updateMe(req, res) {
    // findById (done by authenticate) → change → save(), so validation runs and the
    // password hook re-hashes the password if it changed. 'role' and 'email' are not allowed.
    Object.assign(req.user, pick(req.body, ["name", "interests", "password"]));
    await req.user.save();
    res.json({ user: req.user });
}

// GET /api/users/by-interest?interest=&page=&limit=   (Scenario 1)
export async function usersByInterest(req, res) {
    const { page, limit, skip } = getPagination(req.query);
    // Normalise the same way the schema stores interests (trimmed, lowercased)
    const interest =
        typeof req.query.interest === "string"
            ? req.query.interest.trim().toLowerCase()
            : "";

    // The ONE and only database call for this view
    const [result] = await User.aggregate(
        usersByInterestPipeline({ interest, skip, limit }),
    );

    // $facet always outputs exactly one document, so result is always defined
    res.json(paginated(result.data, { page, limit }, result.total));
}

// GET /api/users/:id/posts?page=&limit=   (Scenario 2)
export async function userPosts(req, res) {
    const { page, limit, skip } = getPagination(req.query);
    // validateId already rejected malformed ids; aggregate() needs a real ObjectId
    const userId = new mongoose.Types.ObjectId(req.params.id);

    const [result] = await User.aggregate(
        userPostsPipeline({ userId, skip, limit }),
    );
    if (!result) throw new ApiError(404, "User not found");

    res.json({
        user: { _id: result._id, name: result.name },
        data: result.posts,
        pagination: { page, limit, hasNextPage: result.hasNextPage },
    });
}
