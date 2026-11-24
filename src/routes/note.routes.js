import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { validateId } from "../middleware/validateId.js";
import * as notes from "../controllers/note.controller.js";

const router = Router();

// Any logged-in role, so admins can use these too (admin "inherits" user abilities)
router.use(authenticate);

router.route("/").get(notes.listMyNotes).post(notes.createNote);
router
    .route("/:id")
    .all(validateId)
    .get(notes.getMyNote)
    .patch(notes.updateMyNote)
    .delete(notes.deleteMyNote);

export default router;
