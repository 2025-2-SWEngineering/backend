import pool from "../config/database.js";

export type UserPreferenceRow = {
    user_id: number;
    receive_dues_reminders: boolean;
};

export async function initUserPreferenceModel(): Promise<void> {
    const sql = `
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      receive_dues_reminders BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
    await pool.query(sql);
}

export async function getUserPreferences(userId: number): Promise<UserPreferenceRow> {
    const { rows } = await pool.query<UserPreferenceRow>(
        `SELECT user_id, receive_dues_reminders FROM user_preferences WHERE user_id = $1`,
        [userId]
    );
    if (rows.length === 0) {
        return { user_id: userId, receive_dues_reminders: true };
    }
    return rows[0] as UserPreferenceRow;
}

export async function upsertUserPreferences(
    userId: number,
    { receive_dues_reminders }: { receive_dues_reminders?: boolean }
): Promise<UserPreferenceRow> {
    const { rows } = await pool.query<UserPreferenceRow>(
        `INSERT INTO user_preferences (user_id, receive_dues_reminders)
     VALUES ($1, COALESCE($2, true))
     ON CONFLICT (user_id)
     DO UPDATE SET receive_dues_reminders = EXCLUDED.receive_dues_reminders,
                   updated_at = NOW()
     RETURNING user_id, receive_dues_reminders`,
        [userId, receive_dues_reminders]
    );
    return rows[0] as UserPreferenceRow;
}
