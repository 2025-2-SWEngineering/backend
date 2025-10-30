import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import * as pref from "../controllers/userPreferencesController.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/preferences", pref.get);

router.put("/preferences", pref.update);

export default router;
