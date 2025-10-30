import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import * as dues from "../controllers/duesController.js";
import { validate, schemas } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticateToken);

// 회비 현황 조회
router.get("/", validate(schemas.dues.list), dues.list);

// 회비 납부 상태 업데이트 (관리자 전용)
router.put("/", validate(schemas.dues.update), dues.update);

export default router;
