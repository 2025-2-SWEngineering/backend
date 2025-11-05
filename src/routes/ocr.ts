import express from "express";
import { authenticateToken } from "../middleware/auth.js";
import { ocrUpload, parseReceipt } from "../controllers/ocrController.js";

const router = express.Router();

router.use(authenticateToken);

router.post("/parse", ocrUpload.single("file"), parseReceipt);

export default router;


