import { Request, Response, NextFunction } from "express";
import { getUserGroupRole } from "../models/groupModel.js";
import { listNotificationLogs } from "../models/notificationLogModel.js";
import { getUnpaidUsers, testDuesRemindersForGroup } from "../services/notificationService.js";

// 알림 로그 조회
export async function listLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const q = req.query as { groupId?: string; userId?: string };
        const userId = req.user!.id;
        const groupId = q.groupId ? Number(q.groupId) : null;
        const targetUserId = q.userId ? Number(q.userId) : null;

        // 그룹이 지정된 경우 권한 확인
        let isAdmin = false;
        if (groupId) {
            const role = await getUserGroupRole(userId, groupId);
            if (!role) {
                return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
            }
            isAdmin = role === "admin";
        }

        const logs = await listNotificationLogs({
            userId,
            groupId,
            targetUserId,
            isAdmin,
        });

        res.json({ logs });
    } catch (err) {
        next(err);
    }
}

// 회비 납부 알림 수동 테스트 (관리자 전용)
export async function testDuesReminder(req: Request, res: Response, next: NextFunction) {
    try {
        const { groupId } = req.body as { groupId?: number };
        if (!groupId) {
            return res.status(400).json({ message: "groupId가 필요합니다." });
        }

        const userId = req.user!.id;
        const role = await getUserGroupRole(userId, groupId);
        if (role !== "admin") {
            return res.status(403).json({ message: "관리자 권한이 필요합니다." });
        }

        const users = await getUnpaidUsers(groupId);
        const results = await testDuesRemindersForGroup(groupId);

        res.json({
            group_id: groupId,
            total_users: users.length,
            results,
        });
    } catch (err) {
        next(err);
    }
}

