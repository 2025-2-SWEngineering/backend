import express, { Request, Response, NextFunction } from "express";
import { authenticateToken } from "../middleware/auth.js";
import * as groups from "../controllers/groupsController.js";
import { validate, schemas } from "../middleware/validate.js";

const router = express.Router();

router.use(authenticateToken);

router.get("/", groups.list);

router.post("/", validate(schemas.groups.create), groups.create);

// 초대코드 생성 (관리자 전용)
router.post("/:groupId/invitations", groups.createInvite);

// 멤버 목록 조회 (멤버 이상)
router.get("/:groupId/members", groups.members);

// 멤버 역할 변경 (관리자 전용)
router.put("/:groupId/members/:userId/role", groups.changeRole);

export default router;
