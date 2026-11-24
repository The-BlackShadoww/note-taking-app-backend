import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validateId } from "../middleware/validateId.js";
import * as users from "../controllers/user.controller.js";

const router = Router();

router.use(authenticate); // every route below needs a login

router.route("/me").get(users.getMe).patch(users.updateMe);
router.get("/by-interest", users.usersByInterest); // Scenario 1
router.get("/:id/posts", validateId, users.userPosts); // Scenario 2

export default router;
