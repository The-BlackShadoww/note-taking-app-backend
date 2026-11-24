import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { validateId } from "../middleware/validateId.js";
import * as admin from "../controllers/admin.controller.js";

const router = Router();

// Every route below is admin-only: 401 without a valid token, 403 for non-admins
router.use(authenticate, authorize("admin"));

router.route("/users").get(admin.listUsers).post(admin.createUser);
router
    .route("/users/:id")
    .all(validateId)
    .get(admin.getUser)
    .patch(admin.updateUser)
    .delete(admin.deleteUser);

// Admins can view everyone's notes, but not change them (read-only by design)
router.get("/notes", admin.listAllNotes);
router.get("/notes/:id", validateId, admin.getAnyNote);

export default router;
