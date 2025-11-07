import pool from "../config/database.js";

export type PushSubscriptionRow = {
    id: number;
    user_id: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    created_at: string;
    updated_at: string;
};

export async function initPushSubscriptionModel(): Promise<void> {
    const sql = `
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, endpoint)
    );
  `;
    await pool.query(sql);
}

export async function savePushSubscription(
    userId: number,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<PushSubscriptionRow> {
    const { rows } = await pool.query<PushSubscriptionRow>(
        `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET p256dh = EXCLUDED.p256dh,
                   auth = EXCLUDED.auth,
                   updated_at = NOW()
     RETURNING *`,
        [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    );
    return rows[0] as PushSubscriptionRow;
}

export async function getPushSubscriptionsByUserId(
    userId: number
): Promise<PushSubscriptionRow[]> {
    const { rows } = await pool.query<PushSubscriptionRow>(
        `SELECT * FROM push_subscriptions WHERE user_id = $1`,
        [userId]
    );
    return rows;
}

export async function getPushSubscriptionsByUserIds(
    userIds: number[]
): Promise<PushSubscriptionRow[]> {
    if (userIds.length === 0) {
        return [];
    }
    const { rows } = await pool.query<PushSubscriptionRow>(
        `SELECT * FROM push_subscriptions WHERE user_id = ANY($1::int[])`,
        [userIds]
    );
    return rows;
}

export async function deletePushSubscription(
    userId: number,
    endpoint: string
): Promise<void> {
    await pool.query(
        `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
        [userId, endpoint]
    );
}

