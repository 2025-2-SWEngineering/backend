import pool from "../config/database.js";

export type FcmTokenRow = {
  id: number;
  user_id: number;
  token: string;
  platform?: string | null;
  created_at: string;
  updated_at: string;
};

// 모델 초기화: 테이블 생성
export async function initFcmTokenModel(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS fcm_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      platform TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(sql);
}

// 토큰 저장: 이미 존재하면 업데이트
export async function saveFcmToken(params: {
  userId: number;
  token: string;
  platform?: string;
}): Promise<FcmTokenRow> {
  const { userId, token, platform } = params;

  const { rows } = await pool.query<FcmTokenRow>(
    `INSERT INTO fcm_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token)
     DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = NOW()
     RETURNING *`,
    [userId, token, platform || null]
  );
  return rows[0];
}

export async function deleteFcmToken(params: {
  userId: number;
  token: string;
}): Promise<void> {
  const { userId, token } = params;

  await pool.query(`DELETE FROM fcm_tokens WHERE user_id = $1 AND token = $2`, [
    userId,
    token,
  ]);
}
export async function deleteFcmTokensByToken(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  await pool.query(`DELETE FROM fcm_tokens WHERE token = ANY($1::text[])`, [
    tokens,
  ]);
}

export async function getFcmTokensByUserIds(
  userIds: number[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const { rows } = await pool.query<{ token: string }>(
    `SELECT token FROM fcm_tokens WHERE user_id = ANY($1::int[])`,
    [userIds]
  );
  return rows.map((r) => r.token);
}

export async function getFcmTokensByUserId(userId: number): Promise<string[]> {
  const { rows } = await pool.query<{ token: string }>(
    `SELECT token FROM fcm_tokens WHERE user_id = $1`,
    [userId]
  );
  return rows.map((r) => r.token);
}
