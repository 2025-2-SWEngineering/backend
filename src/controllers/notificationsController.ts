import { Request, Response, NextFunction } from "express";
import pool from "../config/database.js";
import { sendDuesReminder } from "../services/notificationService.js";
import { insertNotificationLog } from "../models/notificationLogModel.js";
import { getUserGroupRole } from "../models/groupModel.js";

// 알림 로그 조회
export async function listLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as { groupId?: string; userId?: string };
    const userId = req.user!.id;
    const groupId = q.groupId ? Number(q.groupId) : null;

    // 그룹이 지정된 경우 권한 확인
    if (groupId) {
      const role = await getUserGroupRole(userId, groupId);
      if (!role) {
        return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
      }
    }

    let sql = `
      SELECT nl.id, nl.user_id, nl.group_id, nl.type, nl.message, nl.sent_at,
             u.name AS user_name, g.name AS group_name
      FROM notification_logs nl
      JOIN users u ON u.id = nl.user_id
      JOIN groups g ON g.id = nl.group_id
      WHERE 1=1
    `;
    const params: unknown[] = [];
    let paramIndex = 1;

    // 본인 알림만 조회 (관리자가 아닌 경우)
    const isAdmin = groupId ? (await getUserGroupRole(userId, groupId)) === "admin" : false;
    if (!isAdmin) {
      sql += ` AND nl.user_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    }

    if (groupId) {
      sql += ` AND nl.group_id = $${paramIndex}`;
      params.push(groupId);
      paramIndex++;
    }

    if (q.userId) {
      sql += ` AND nl.user_id = $${paramIndex}`;
      params.push(Number(q.userId));
      paramIndex++;
    }

    sql += ` ORDER BY nl.sent_at DESC LIMIT 100`;

    const { rows } = await pool.query(sql, params);
    res.json({ logs: rows });
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

    // 미납자 조회
    const { rows } = await pool.query<{
      group_id: number;
      group_name: string;
      user_id: number;
      user_name: string;
      email: string;
      unpaid_count: string | number;
      receive_dues_reminders?: boolean | null;
    }>(
      `SELECT ug.group_id, g.name AS group_name, u.id AS user_id, u.name AS user_name, u.email,
              COUNT(*) FILTER (WHERE d.is_paid = false OR d.is_paid IS NULL) AS unpaid_count,
              up.receive_dues_reminders
       FROM user_groups ug
       JOIN users u ON u.id = ug.user_id
       JOIN groups g ON g.id = ug.group_id
       LEFT JOIN dues d ON d.group_id = ug.group_id AND d.user_id = ug.user_id
       LEFT JOIN user_preferences up ON up.user_id = u.id
       WHERE ug.group_id = $1
       GROUP BY ug.group_id, g.name, u.id, u.name, u.email, up.receive_dues_reminders`,
      [groupId]
    );

    const results: Array<{
      user_id: number;
      user_name: string;
      email: string;
      sent: boolean;
      reason?: string;
    }> = [];

    for (const r of rows) {
      const allow = r.receive_dues_reminders !== false; // default true
      const unpaidCount = Number(r.unpaid_count);

      if (!allow) {
        results.push({
          user_id: r.user_id,
          user_name: r.user_name,
          email: r.email,
          sent: false,
          reason: "알림 설정이 비활성화되어 있습니다.",
        });
        continue;
      }

      if (unpaidCount === 0) {
        results.push({
          user_id: r.user_id,
          user_name: r.user_name,
          email: r.email,
          sent: false,
          reason: "미납 내역이 없습니다.",
        });
        continue;
      }

      try {
        await sendDuesReminder({
          toEmail: r.email,
          userName: r.user_name,
          groupName: r.group_name,
          unpaidCount,
        });

        await insertNotificationLog({
          userId: r.user_id,
          groupId: r.group_id,
          type: "dues_reminder",
          message: `${r.group_name}: 미납 ${unpaidCount}건 안내 발송 (테스트)`,
        });

        results.push({
          user_id: r.user_id,
          user_name: r.user_name,
          email: r.email,
          sent: true,
        });
      } catch (err) {
        results.push({
          user_id: r.user_id,
          user_name: r.user_name,
          email: r.email,
          sent: false,
          reason: err instanceof Error ? err.message : "알 수 없는 오류",
        });
      }
    }

    res.json({
      group_id: groupId,
      total_users: rows.length,
      results,
    });
  } catch (err) {
    next(err);
  }
}

