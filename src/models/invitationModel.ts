import pool from "../config/database.js";

export type InvitationRow = {
    id: number;
    group_id: number;
    code: string;
    expires_at: string;
    created_by: number;
    created_at: string;
    accepted_at?: string | null;
    accepted_by?: number | null;
};

export async function initInvitationModel(): Promise<void> {
    const createSql = `
    CREATE TABLE IF NOT EXISTS invitations (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      accepted_at TIMESTAMPTZ,
      accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
  `;
    await pool.query(createSql);
}

function generateInviteCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

export async function createInvitation({
    groupId,
    createdBy,
    ttlHours = 72,
}: {
    groupId: number;
    createdBy: number;
    ttlHours?: number;
}): Promise<Pick<InvitationRow, "id" | "group_id" | "code" | "expires_at" | "created_at">> {
    let code: string;
    // ensure unique
  while (true) {
    code = generateInviteCode();
    const { rows } = await pool.query<{ exists: number }>(
      `SELECT 1 as exists FROM invitations WHERE code = $1`,
      [code]
    );
    if (rows.length === 0) break;
  }
  const { rows } = await pool.query<Pick<InvitationRow, "id" | "group_id" | "code" | "expires_at" | "created_at">>(
        `INSERT INTO invitations (group_id, code, expires_at, created_by)
     VALUES ($1, $2, NOW() + ($3 || ' hours')::interval, $4)
     RETURNING id, group_id, code, expires_at, created_at`,
        [groupId, code, ttlHours, createdBy]
    );
  return rows[0];
}

export async function getInvitationByCode(code: string): Promise<InvitationRow | null> {
  const { rows } = await pool.query<InvitationRow>(
    `SELECT * FROM invitations WHERE code = $1 LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

export async function markInvitationAccepted({ id, userId }: { id: number; userId: number }): Promise<void> {
    await pool.query(`UPDATE invitations SET accepted_at = NOW(), accepted_by = $2 WHERE id = $1`, [id, userId]);
}

export async function deleteExpiredInvitations(): Promise<void> {
    await pool.query(`DELETE FROM invitations WHERE expires_at < NOW() AND accepted_at IS NULL`);
}
