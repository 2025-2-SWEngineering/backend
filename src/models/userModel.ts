import pool from "../config/database.js";

export type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: string;
};

export async function initUserModel(): Promise<void> {
  const createTableSql = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(createTableSql);
}

export async function createUser({
  email,
  passwordHash,
  name,
  role = "member",
}: {
  email: string;
  passwordHash: string;
  name: string;
  role?: string;
}): Promise<Pick<UserRow, "id" | "email" | "name" | "role" | "created_at">> {
  const insertSql = `
    INSERT INTO users (email, password_hash, name, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, name, role, created_at;
  `;
  const { rows } = await pool.query<Pick<UserRow, "id" | "email" | "name" | "role" | "created_at">>(
    insertSql,
    [email, passwordHash, name, role]
  );
  return rows[0];
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await pool.query<UserRow>(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}
