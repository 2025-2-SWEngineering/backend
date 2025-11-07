import express from "express";
import { getVapidKey, subscribe, unsubscribe } from "../controllers/pushController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// VAPID 공개 키 조회 (인증 불필요)
router.get("/vapid-key", getVapidKey);

// 푸시 구독 관련 라우트는 인증 필요
router.use(authenticateToken);
router.post("/subscribe", subscribe);
router.post("/unsubscribe", unsubscribe);

export default router;

