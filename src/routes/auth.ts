import express from "express";
import { register, login, refresh } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.get("/me", authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
