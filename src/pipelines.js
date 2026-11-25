import { Post } from "./models/Post.js";

// The two aggregation pipelines, as pure functions that return arrays of stages.
// Study guide 05 traces both of them stage by stage with sample data.

// How many users each interest group lists (userCount is still the true total)
export const USERS_PER_GROUP = 20;

// ---------- Scenario 1: users grouped by interests (ONE aggregate call) ----------
export function usersByInterestPipeline({ interest, skip, limit }) {
    // The first $match ALWAYS uses the multikey index interests_1:
    // - with ?interest=: only the users who have that interest;
    // - without it: only users with at least one interest ($type "string" matches
    //   any string element), so the plan is IXSCAN, never a full COLLSCAN.
    //   Users without interests are skipped before they are read ($unwind would
    //   drop them anyway).
    const indexedMatch = {
        $match: { interests: interest || { $type: "string" } },
    };
    // After $unwind, drop the user's other interests (only needed with a filter)
    const onlyThisInterest = interest
        ? [{ $match: { interests: interest } }]
        : [];

    return [
        // ① index: interests_1 (multikey), with or without a filter
        indexedMatch,
        // ② keep only public fields: drop email, password, role
        { $project: { name: 1, interests: 1 } },
        // ③ one document per (user, interest) pair
        { $unwind: "$interests" },
        // ④ keep only the requested interest (a user may have several)
        ...onlyThisInterest,
        // ⑤ one document per interest, with its users. $firstN (not $push) caps the
        //   list, so a very popular interest can't grow past MongoDB's 16 MB limit.
        {
            $group: {
                _id: "$interests",
                userCount: { $sum: 1 },
                users: {
                    $firstN: {
                        n: USERS_PER_GROUP,
                        input: { _id: "$_id", name: "$name" },
                    },
                },
            },
        },
        // ⑥ most popular first, ties A→Z (a stable order makes pages stable)
        { $sort: { userCount: -1, _id: 1 } },
        // ⑦ the page AND the total in the same call
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $project: {
                            _id: 0,
                            interest: "$_id",
                            userCount: 1,
                            users: 1,
                        },
                    },
                ],
                totalCount: [{ $count: "count" }],
            },
        },
        // ⑧ final shape: { data, total }
        {
            $project: {
                data: 1,
                total: {
                    $ifNull: [{ $arrayElemAt: ["$totalCount.count", 0] }, 0],
                },
            },
        },
    ];
}

// ---------- Scenario 2: one user's posts with $lookup (ONE pipeline) ----------
export function userPostsPipeline({ userId, skip, limit }) {
    return [
        // ① users: _id_ index → one user (userId must be an ObjectId: aggregate doesn't cast)
        { $match: { _id: userId } },
        // ② public fields only
        { $project: { name: 1 } },
        // ③ the join: this user's posts, sorted and paginated inside the lookup
        {
            $lookup: {
                from: Post.collection.name, // "posts"
                localField: "_id",
                foreignField: "author", // posts index: author_1__id_-1
                pipeline: [
                    // newest first: same index (Equality author + Sort _id), no in-memory sort
                    { $sort: { _id: -1 } },
                    { $skip: skip },
                    // fetch ONE extra to find out whether a next page exists
                    { $limit: limit + 1 },
                    { $project: { title: 1, content: 1, createdAt: 1 } },
                ],
                as: "posts",
            },
        },
        // ④ trim the extra post and flag the next page
        {
            $project: {
                name: 1,
                posts: { $slice: ["$posts", limit] },
                hasNextPage: { $gt: [{ $size: "$posts" }, limit] },
            },
        },
    ];
}
