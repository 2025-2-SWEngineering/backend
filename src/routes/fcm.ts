import express from "express";
import {
  registerToken,
  unregisterToken,
  sendTest,
} from "../controllers/fcmController.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

// 토큰 등록/해제는 인증 필요
router.use(authenticateToken);
router.post("/register", registerToken);
router.post("/unregister", unregisterToken);

// 테스트 전송은 관리자만 사용(requires controller-level check)
router.post("/send-test", sendTest);

export default router;
