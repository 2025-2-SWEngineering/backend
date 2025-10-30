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
