import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import * as reports from "../controllers/reportsController.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/summary.pdf", reports.summaryPdf);

router.get("/summary.xlsx", reports.summaryXlsx);

export default router;
