// Prints which index each important query uses: the proof for the indexing requirement.
// Run after the seed: npm run explain
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Note } from "../src/models/Note.js";
import { Post } from "../src/models/Post.js";
import {
    usersByInterestPipeline,
    userPostsPipeline,
} from "../src/pipelines.js";

await mongoose.connect(process.env.MONGODB_URI);
const alice = await User.findOne({ email: "alice@example.com" }).lean();
if (!alice) {
    console.error("No demo data found. Run `npm run seed` first.");
    process.exit(1);
}
const aNote = await Note.findOne({ user: alice._id }).lean();

// Pull the useful facts out of explain() output, whatever the server version's layout
function summarize(explain) {
    const text = JSON.stringify(explain);
    const all = (re) => [
        ...new Set([...text.matchAll(re)].map((m) => m[1])),
    ];
    return {
        stages: all(/"stage":"([A-Z_]+)"/g).join(", "),
        indexes:
            [
                ...new Set([
                    ...all(/"indexName":"([^"]+)"/g),
                    ...all(/"indexesUsed":\["([^"]+)"/g),
                ]),
            ].join(", ") || "-",
        keysExamined: all(/"totalKeysExamined":(\d+)/g).join(", "),
        docsExamined: all(/"totalDocsExamined":(\d+)/g).join(", "),
    };
}

const checks = {
    "Login: findOne({ email })": () =>
        User.findOne({ email: "alice@example.com" }).explain("executionStats"),
    "My notes page 2: find({ user }).sort({ _id: -1 })": () =>
        Note.find({ user: alice._id })
            .sort({ _id: -1 })
            .skip(10)
            .limit(10)
            .explain("executionStats"),
    // countDocuments runs this aggregation under the hood
    "My notes total: countDocuments({ user })": () =>
        Note.aggregate([
            { $match: { user: alice._id } },
            { $group: { _id: 1, n: { $sum: 1 } } },
        ]).explain("executionStats"),
    "One note: findOne({ _id, user })": () =>
        Note.findOne({ _id: aNote._id, user: alice._id }).explain(
            "executionStats",
        ),
    "Admin users: find().sort({ _id: -1 })": () =>
        User.find().sort({ _id: -1 }).limit(10).explain("executionStats"),
    "Admin notes: find().sort({ _id: -1 })": () =>
        Note.find().sort({ _id: -1 }).limit(10).explain("executionStats"),
    "Posts feed: find().sort({ _id: -1 })": () =>
        Post.find().sort({ _id: -1 }).limit(10).explain("executionStats"),
    "Scenario 1 (interest=chess)": () =>
        User.aggregate(
            usersByInterestPipeline({ interest: "chess", skip: 0, limit: 10 }),
        ).explain("executionStats"),
    "Scenario 1 (all groups): full scan expected": () =>
        User.aggregate(
            usersByInterestPipeline({ interest: "", skip: 0, limit: 10 }),
        ).explain("executionStats"),
    "Scenario 2: $lookup posts (page 1, limit 5)": () =>
        User.aggregate(
            userPostsPipeline({ userId: alice._id, skip: 0, limit: 5 }),
        ).explain("executionStats"),
};

for (const [name, run] of Object.entries(checks)) {
    console.log(`\n${name}`);
    console.table(summarize(await run()));
}

// The complete index list: there should be exactly 7
console.log("\nIndexes in the database");
let total = 0;
for (const Model of [User, Note, Post]) {
    const names = (await Model.collection.indexes()).map((i) => i.name);
    total += names.length;
    console.log(`  ${Model.collection.name}: ${names.join(", ")}`);
}
console.log(`  total: ${total}`);

await mongoose.disconnect();
