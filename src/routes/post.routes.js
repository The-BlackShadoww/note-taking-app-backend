import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import * as posts from "../controllers/post.controller.js";

const router = Router();

router.use(authenticate); // any logged-in user can read the feed and post

router.route("/").get(posts.listPosts).post(posts.createPost);

export default router;
