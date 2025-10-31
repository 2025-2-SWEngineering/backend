import pool from "../config/database.js";

export type GroupRow = {
    id: number;
    name: string;
    code: string;
    created_at: string;
};

export async function initGroupModel(): Promise<void> {
    const createGroupsSql = `
    CREATE TABLE IF NOT EXISTS groups (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

    const createUserGroupsSql = `
    CREATE TABLE IF NOT EXISTS user_groups (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, group_id)
    );
  `;

    await pool.query(createGroupsSql);
    await pool.query(createUserGroupsSql);
}

function generateGroupCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i += 1) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

export async function createGroup({
    name,
    ownerUserId,
}: {
    name: string;
    ownerUserId: number;
}): Promise<GroupRow> {
    let code: string;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        code = generateGroupCode();
        const { rows } = await pool.query<{ exists: number }>(
            `SELECT 1 as exists FROM groups WHERE code = $1 LIMIT 1`,
            [code]
        );
        if (rows.length === 0) break;
    }

    const { rows: groupRows } = await pool.query<GroupRow>(
        `INSERT INTO groups (name, code) VALUES ($1, $2)
     RETURNING id, name, code, created_at`,
        [name, code]
    );
    const group = groupRows[0] as GroupRow;

    await pool.query(`INSERT INTO user_groups (user_id, group_id, role) VALUES ($1, $2, $3)`, [
        ownerUserId,
        group.id,
        "admin",
    ]);

    return group;
}

export async function getGroupsForUser(userId: number): Promise<Array<GroupRow & { user_role: string }>> {
    const { rows } = await pool.query<(GroupRow & { user_role: string })>(
        `SELECT g.id, g.name, g.code, g.created_at, ug.role as user_role
     FROM user_groups ug
     JOIN groups g ON g.id = ug.group_id
     WHERE ug.user_id = $1
     ORDER BY g.created_at DESC`,
        [userId]
    );
    return rows;
}

export async function getUserGroupRole(userId: number, groupId: number): Promise<string | null> {
    const { rows } = await pool.query<{ role: string }>(
        `SELECT role FROM user_groups WHERE user_id = $1 AND group_id = $2 LIMIT 1`,
        [userId, groupId]
    );
    return rows[0]?.role || null;
}

export async function listGroupMembers(groupId: number): Promise<Array<{ user_id: number; user_name: string; role: string }>> {
    const { rows } = await pool.query<{ user_id: number; user_name: string; role: string }>(
        `SELECT u.id AS user_id, COALESCE(u.name, u.email) AS user_name, ug.role
     FROM user_groups ug
     JOIN users u ON u.id = ug.user_id
     WHERE ug.group_id = $1
     ORDER BY u.id ASC`,
        [groupId]
    );
    return rows;
}

export async function countAdminsInGroup(groupId: number): Promise<number> {
    const { rows } = await pool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM user_groups WHERE group_id = $1 AND role = 'admin'`,
        [groupId]
    );
    return rows[0]?.cnt ?? 0;
}

export async function countMembersInGroup(groupId: number): Promise<number> {
    const { rows } = await pool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM user_groups WHERE group_id = $1`,
        [groupId]
    );
    return rows[0]?.cnt ?? 0;
}

export async function removeUserFromGroup({
    userId,
    groupId,
}: {
    userId: number;
    groupId: number;
}): Promise<void> {
    await pool.query(`DELETE FROM user_groups WHERE user_id = $1 AND group_id = $2`, [userId, groupId]);
}

export async function deleteGroup(groupId: number): Promise<void> {
    // groups 삭제 시 transactions/dues/invitations/user_groups/notification_logs 는 FK 의 ON DELETE CASCADE 로 정리됨
    await pool.query(`DELETE FROM groups WHERE id = $1`, [groupId]);
}

export async function setUserGroupRole({
    userId,
    groupId,
    role,
}: {
    userId: number;
    groupId: number;
    role: "admin" | "member";
}): Promise<{ user_id: number; group_id: number; role: string } | null> {
    const { rows } = await pool.query<{ user_id: number; group_id: number; role: string }>(
        `UPDATE user_groups
     SET role = $3
     WHERE user_id = $1 AND group_id = $2
     RETURNING user_id, group_id, role`,
        [userId, groupId, role]
    );
    return rows[0] || null;
}
