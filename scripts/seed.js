// Demo data + the first admin. WARNING: wipes the users, notes and posts collections first.
// Run: npm run seed
import mongoose from "mongoose";
import { User } from "../src/models/User.js";
import { Note } from "../src/models/Note.js";
import { Post } from "../src/models/Post.js";

const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first");
    process.exit(1);
}

await mongoose.connect(MONGODB_URI);
console.log("Seeding database:", mongoose.connection.name);

// 1. Start clean, and make the DB's indexes match the schemas exactly
//    (syncIndexes also drops any leftover experimental index)
await Promise.all([
    User.deleteMany({}),
    Note.deleteMany({}),
    Post.deleteMany({}),
]);
await Promise.all([
    User.syncIndexes(),
    Note.syncIndexes(),
    Post.syncIndexes(),
]);

// 2. Users. create() runs the pre('save') hook, so passwords are hashed
//    (insertMany would NOT run it). These are local demo accounts.
const [admin, alice, bob] = await User.create([
    {
        name: "Admin",
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: "admin",
        interests: ["chess"],
    },
    {
        name: "Alice",
        email: "alice@example.com",
        password: "password123",
        interests: ["chess", "reading"],
    },
    {
        name: "Bob",
        email: "bob@example.com",
        password: "password123",
        interests: ["reading", "hiking"],
    },
    {
        name: "Carol",
        email: "carol@example.com",
        password: "password123",
        interests: [" Chess "], // stored as 'chess'
    },
    {
        name: "Dan",
        email: "dan@example.com",
        password: "password123",
        interests: [], // appears in no interest group
    },
]);

// 3. Notes: enough for Alice to page through
await Note.insertMany([
    ...Array.from({ length: 25 }, (_, i) => ({
        user: alice._id,
        title: `Alice note ${i + 1}`,
        content: "Lorem ipsum",
    })),
    { user: bob._id, title: "Bob note", content: "Hi" },
    { user: admin._id, title: "Admin note", content: "Admins have notes too" },
]);

// 4. Posts: enough for Scenario 2 to have several pages
await Post.insertMany([
    ...Array.from({ length: 12 }, (_, i) => ({
        author: alice._id,
        title: `Alice post ${i + 1}`,
        content: "Hello world",
    })),
    { author: bob._id, title: "Bob post", content: "Hiking this weekend" },
]);

const [users, notes, posts] = await Promise.all([
    User.countDocuments(),
    Note.countDocuments(),
    Post.countDocuments(),
]);
console.log(`Seed complete: ${users} users, ${notes} notes, ${posts} posts`);
console.log("Admin login:", ADMIN_EMAIL);
console.log("Demo logins: alice@example.com, bob@example.com (password123)");
await mongoose.disconnect();
