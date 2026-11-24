import { User } from "../models/User.js";
import { Note } from "../models/Note.js";
import { Post } from "../models/Post.js";
import { ApiError } from "../utils/ApiError.js";
import { pick } from "../utils/pick.js";
import { getPagination, paginated } from "../utils/pagination.js";

// Unlike self-registration, an admin may set the role
const USER_FIELDS = ["name", "email", "password", "role", "interests"];

// ---------- Users CRUD ----------

// GET /api/admin/users?page=&limit=
export async function listUsers(req, res) {
    const p = getPagination(req.query);
    const [users, total] = await Promise.all([
        // the automatic _id_ index walks newest first; select:false keeps the hash out
        User.find().sort({ _id: -1 }).skip(p.skip).limit(p.limit).lean(),
        User.estimatedDocumentCount(), // collection metadata, no scan
    ]);
    res.json(paginated(users, p, total));
}

// GET /api/admin/users/:id
export async function getUser(req, res) {
    const user = await User.findById(req.params.id).lean(); // _id_
    if (!user) throw new ApiError(404, "User not found");
    res.json({ user });
}

// POST /api/admin/users
export async function createUser(req, res) {
    const user = await User.create(pick(req.body, USER_FIELDS)); // the hook hashes the password
    res.status(201).json({ user });
}

// PATCH /api/admin/users/:id
export async function updateUser(req, res) {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "User not found");

    // An admin can't lock themselves out by removing their own admin role
    const isSelf = user._id.equals(req.user._id);
    if (isSelf && req.body.role && req.body.role !== "admin") {
        throw new ApiError(400, "You cannot remove your own admin role");
    }

    Object.assign(user, pick(req.body, USER_FIELDS));
    await user.save(); // save(), NOT findByIdAndUpdate, so a new password gets hashed
    res.json({ user });
}

// DELETE /api/admin/users/:id
export async function deleteUser(req, res) {
    if (req.user._id.equals(req.params.id)) {
        throw new ApiError(400, "You cannot delete yourself");
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError(404, "User not found");

    // Cascade: remove everything the user owned
    await Promise.all([
        Note.deleteMany({ user: user._id }), // index prefix of user_1__id_-1
        Post.deleteMany({ author: user._id }), // index prefix of author_1__id_-1
    ]);
    res.status(204).end();
}

// ---------- Everyone's notes (read-only) ----------

// GET /api/admin/notes?page=&limit=
export async function listAllNotes(req, res) {
    const p = getPagination(req.query);
    const [notes, total] = await Promise.all([
        Note.find()
            .sort({ _id: -1 }) // the automatic _id_ index
            .skip(p.skip)
            .limit(p.limit)
            .populate("user", "name email") // 2nd query: User.find({ _id: { $in } }) → _id_
            .lean(),
        Note.estimatedDocumentCount(),
    ]);
    res.json(paginated(notes, p, total));
}

// GET /api/admin/notes/:id
export async function getAnyNote(req, res) {
    const note = await Note.findById(req.params.id)
        .populate("user", "name email")
        .lean();
    if (!note) throw new ApiError(404, "Note not found");
    res.json({ note });
}
