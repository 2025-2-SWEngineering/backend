import express, { Request, Response } from "express";
import authRouter from "./auth.js";
import groupsRouter from "./groups.js";
import invitationsRouter from "./invitations.js";
import transactionsRouter from "./transactions.js";
import uploadsRouter from "./uploads.js";
import duesRouter from "./dues.js";
import reportsRouter from "./reports.js";
import userPreferencesRouter from "./userPreferences.js";
import ocrRouter from "./ocr.js";
import notificationsRouter from "./notifications.js";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
  res.json({ message: "우리회계 API", version: "1.0.0" });
});

router.use("/auth", authRouter);
router.use("/groups", groupsRouter);
router.use("/invitations", invitationsRouter);
router.use("/transactions", transactionsRouter);
router.use("/uploads", uploadsRouter);
router.use("/ocr", ocrRouter);
router.use("/dues", duesRouter);
router.use("/reports", reportsRouter);
router.use("/user", userPreferencesRouter);
router.use("/notifications", notificationsRouter);

export default router;
