import pool from "../config/database.js";

export type NotificationLogRow = {
    id: number;
    user_id: number;
    group_id: number;
    type: string;
    message: string;
    sent_at: string;
};

export async function initNotificationLogModel(): Promise<void> {
    const sql = `
    CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
    await pool.query(sql);
}

export async function insertNotificationLog({
    userId,
    groupId,
    type,
    message,
}: {
    userId: number;
    groupId: number;
    type: string;
    message: string;
}): Promise<void> {
    await pool.query(
        `INSERT INTO notification_logs (user_id, group_id, type, message)
     VALUES ($1, $2, $3, $4)`,
        [userId, groupId, type, message]
    );
}

export type NotificationLogWithDetails = {
    id: number;
    user_id: number;
    group_id: number;
    type: string;
    message: string;
    sent_at: string;
    user_name: string;
    group_name: string;
};

export async function listNotificationLogs({
    userId,
    groupId,
    targetUserId,
    isAdmin,
    limit = 100,
}: {
    userId: number;
    groupId?: number | null;
    targetUserId?: number | null;
    isAdmin: boolean;
    limit?: number;
}): Promise<NotificationLogWithDetails[]> {
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

    if (targetUserId) {
        sql += ` AND nl.user_id = $${paramIndex}`;
        params.push(targetUserId);
        paramIndex++;
    }

    sql += ` ORDER BY nl.sent_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const { rows } = await pool.query<NotificationLogWithDetails>(sql, params);
    return rows;
}
