import pool from "../config/database.js";

export type DuesRow = {
    group_id: number;
    user_id: number;
    is_paid: boolean;
    paid_at?: string | null;
};

export async function initDuesModel(): Promise<void> {
    const createSql = `
    CREATE TABLE IF NOT EXISTS dues (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_paid BOOLEAN NOT NULL DEFAULT false,
      paid_at TIMESTAMPTZ,
      UNIQUE (group_id, user_id)
    );
  `;
    await pool.query(createSql);
}

export async function listDuesByGroup(
    groupId: number
): Promise<Array<{ user_id: number; user_name: string; is_paid: boolean; paid_at?: string | null }>> {
  const { rows } = await pool.query<{ user_id: number; user_name: string; is_paid: boolean; paid_at: string | null }>(
        `SELECT u.id AS user_id, u.name AS user_name,
            COALESCE(d.is_paid, false) AS is_paid, d.paid_at
     FROM user_groups ug
     JOIN users u ON u.id = ug.user_id
     LEFT JOIN dues d ON d.user_id = ug.user_id AND d.group_id = ug.group_id
     WHERE ug.group_id = $1
     ORDER BY u.name ASC`,
        [groupId]
    );
  return rows;
}

export async function setDuesStatus({
    groupId,
    userId,
    isPaid,
}: {
    groupId: number;
    userId: number;
    isPaid: boolean;
}): Promise<DuesRow> {
  const { rows } = await pool.query<DuesRow>(
        `INSERT INTO dues (group_id, user_id, is_paid, paid_at)
     VALUES ($1, $2, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
     ON CONFLICT (group_id, user_id)
     DO UPDATE SET is_paid = EXCLUDED.is_paid,
                   paid_at = CASE WHEN EXCLUDED.is_paid THEN NOW() ELSE NULL END
     RETURNING group_id, user_id, is_paid, paid_at`,
        [groupId, userId, isPaid]
    );
  return rows[0];
}
