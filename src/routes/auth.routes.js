import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";

// Public routes: no authentication needed to register or log in
const router = Router();
router.post("/register", auth.register);
router.post("/login", auth.login);

export default router;
