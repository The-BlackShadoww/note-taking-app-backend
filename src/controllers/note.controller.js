import { Note } from "../models/Note.js";
import { ApiError } from "../utils/ApiError.js";
import { pick } from "../utils/pick.js";
import { getPagination, paginated } from "../utils/pagination.js";

// Every query below includes { user: req.user._id }: ownership is part of the filter, so another
// user's note is simply "not found" (prevents IDOR without revealing that the id exists).

// GET /api/notes?page=&limit=
export async function listMyNotes(req, res) {
    const p = getPagination(req.query);
    const filter = { user: req.user._id };
    const [notes, total] = await Promise.all([
        // index: user_1__id_-1 (equality on user, already sorted by _id, no SORT stage)
        Note.find(filter).sort({ _id: -1 }).skip(p.skip).limit(p.limit).lean(),
        Note.countDocuments(filter), // same index
    ]);
    res.json(paginated(notes, p, total));
}

// POST /api/notes
export async function createNote(req, res) {
    const note = await Note.create({
        ...pick(req.body, ["title", "content"]),
        user: req.user._id, // the owner comes from the token, never from the body
    });
    res.status(201).json({ note });
}

// GET /api/notes/:id
export async function getMyNote(req, res) {
    const note = await Note.findOne({
        _id: req.params.id,
        user: req.user._id,
    }).lean();
    if (!note) throw new ApiError(404, "Note not found");
    res.json({ note });
}

// PATCH /api/notes/:id
export async function updateMyNote(req, res) {
    const note = await Note.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id }, // owner check inside the query
        { $set: pick(req.body, ["title", "content"]) }, // 'user' can never be changed
        // return the updated document; enforce required/maxlength on updates too
        { returnDocument: "after", runValidators: true },
    );
    if (!note) throw new ApiError(404, "Note not found");
    res.json({ note });
}

// DELETE /api/notes/:id
export async function deleteMyNote(req, res) {
    const { deletedCount } = await Note.deleteOne({
        _id: req.params.id,
        user: req.user._id,
    });
    if (deletedCount === 0) throw new ApiError(404, "Note not found");
    res.status(204).end();
}
