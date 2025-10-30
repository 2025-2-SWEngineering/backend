import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { accept } from "../controllers/invitationsController.js";
import { validate, schemas } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/accept", validate(schemas.invitations.accept), accept);

export default router;
