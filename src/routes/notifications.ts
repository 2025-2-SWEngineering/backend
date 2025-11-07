import express from "express";
import { listLogs, testDuesReminder } from "../controllers/notificationsController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// 모든 알림 라우트는 인증 필요
router.use(authenticateToken);

// 알림 로그 조회
router.get("/logs", listLogs);

// 회비 납부 알림 수동 테스트 (관리자 전용)
router.post("/test/dues-reminder", testDuesReminder);

export default router;

