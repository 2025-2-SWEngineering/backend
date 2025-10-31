import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import { validate, schemas } from "../middleware/validate.js";
import * as tx from "../controllers/transactionsController.js";

const router = express.Router();

router.use(authenticateToken);

// 목록
router.get("/", validate(schemas.transactions.list), tx.list);

// 통계
router.get("/stats", tx.stats);

// 월별 통계
router.get("/monthly", tx.monthly);

// 항목별 집계
router.get("/by-category", validate(schemas.transactions.byCategory), tx.byCategory);

// 생성
router.post("/", validate(schemas.transactions.create), tx.create);

// 수정 (작성자 또는 관리자)
router.put("/:id", validate(schemas.transactions.update), tx.update);

// 삭제 (작성자 또는 관리자)
router.delete("/:id", tx.remove);

export default router;
