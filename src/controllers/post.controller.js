import { Post } from "../models/Post.js";
import { pick } from "../utils/pick.js";
import { getPagination, paginated } from "../utils/pagination.js";

// POST /api/posts
export async function createPost(req, res) {
    const post = await Post.create({
        ...pick(req.body, ["title", "content"]),
        author: req.user._id, // the author comes from the token, never from the body
    });
    res.status(201).json({ post });
}

// GET /api/posts?page=&limit=
// Feed of everyone's posts. It uses the automatic _id_ index, so it costs no extra index.
export async function listPosts(req, res) {
    const p = getPagination(req.query);
    const [posts, total] = await Promise.all([
        Post.find()
            .sort({ _id: -1 }) // _id_ index, newest first
            .skip(p.skip)
            .limit(p.limit)
            .populate("author", "name") // 2nd query: User.find({ _id: { $in } }) → _id_
            .lean(),
        Post.estimatedDocumentCount(), // collection metadata, no scan
    ]);
    res.json(paginated(posts, p, total));
}
