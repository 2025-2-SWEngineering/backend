import pool from "../config/database.js";

export type TransactionRow = {
    id: number;
    group_id: number;
    type: "income" | "expense";
    amount: number;
    description: string;
    date: string;
    receipt_url?: string | null;
    created_by: number;
    created_at: string;
};

export async function initTransactionModel(): Promise<void> {
    const createSql = `
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income','expense')),
      amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
      description TEXT NOT NULL,
      date DATE NOT NULL,
      receipt_url TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;
    await pool.query(createSql);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_group_id ON transactions(group_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tx_created_by ON transactions(created_by)`);
}

export async function createTransaction({
    groupId,
    type,
    amount,
    description,
    date,
    receiptUrl,
    createdBy,
}: {
    groupId: number;
    type: "income" | "expense";
    amount: number;
    description: string;
    date: string;
    receiptUrl?: string | null;
    createdBy: number;
}): Promise<TransactionRow> {
    const { rows } = await pool.query<TransactionRow>(
        `INSERT INTO transactions (group_id, type, amount, description, date, receipt_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, group_id, type, amount, description, date, receipt_url, created_by, created_at`,
        [groupId, type, amount, description, date, receiptUrl || null, createdBy]
    );
    return rows[0];
}

export async function listTransactionsByGroup(
    groupId: number,
    { limit = 50, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<TransactionRow[]> {
    const { rows } = await pool.query<TransactionRow>(
        `SELECT id, group_id, type, amount::float8 AS amount, description, date, receipt_url, created_by, created_at
     FROM transactions
     WHERE group_id = $1
     ORDER BY date DESC, id DESC
     LIMIT $2 OFFSET $3`,
        [groupId, limit, offset]
    );
    return rows;
}

export async function getStatsByGroup(groupId: number): Promise<{ totalIncome: number; totalExpense: number; currentBalance: number }> {
    const { rows } = await pool.query<{ total_income?: string | number; total_expense?: string | number }>(
        `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense
     FROM transactions
     WHERE group_id = $1`,
        [groupId]
    );
    const agg = rows[0];
    const totalIncome = Number(agg?.total_income || 0);
    const totalExpense = Number(agg?.total_expense || 0);
    return { totalIncome, totalExpense, currentBalance: totalIncome - totalExpense };
}

export async function getMonthlyStatsByGroup(
    groupId: number,
    months = 6
): Promise<Array<{ month: string; income: number; expense: number }>> {
    const { rows } = await pool.query<{ month: string; income: number; expense: number }>(
        `SELECT
       to_char(date_trunc('month', date), 'YYYY-MM') AS month,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::float8 AS income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::float8 AS expense
     FROM transactions
     WHERE group_id = $1
       AND date >= (date_trunc('month', CURRENT_DATE) - ($2::int - 1) * INTERVAL '1 month')
     GROUP BY 1
     ORDER BY 1 ASC`,
        [groupId, months]
    );
    return rows;
}

export async function getTransactionById(id: number): Promise<TransactionRow | null> {
    const { rows } = await pool.query<TransactionRow>(
        `SELECT id, group_id, type, amount::float8 AS amount, description, date, receipt_url, created_by, created_at
     FROM transactions WHERE id = $1 LIMIT 1`,
        [id]
    );
    return rows[0] || null;
}

export async function updateTransaction(
    id: number,
    { type, amount, description, date, receiptUrl }: {
        type?: "income" | "expense";
        amount?: number;
        description?: string;
        date?: string;
        receiptUrl?: string | null;
    }
): Promise<TransactionRow | null> {
    const { rows } = await pool.query<TransactionRow>(
        `UPDATE transactions SET
       type = COALESCE($2, type),
       amount = COALESCE($3, amount),
       description = COALESCE($4, description),
       date = COALESCE($5, date),
       receipt_url = COALESCE($6, receipt_url)
     WHERE id = $1
     RETURNING id, group_id, type, amount::float8 AS amount, description, date, receipt_url, created_by, created_at`,
        [id, type || null, amount != null ? Number(amount) : null, description || null, date || null, receiptUrl || null]
    );
    return rows[0] || null;
}

export async function deleteTransaction(id: number): Promise<void> {
    await pool.query(`DELETE FROM transactions WHERE id = $1`, [id]);
}

export async function getTransactionByReceiptKey(key: string): Promise<Pick<TransactionRow, "id" | "group_id" | "receipt_url"> | null> {
    const { rows } = await pool.query<Pick<TransactionRow, "id" | "group_id" | "receipt_url">>(
        `SELECT id, group_id, receipt_url FROM transactions WHERE receipt_url = $1 LIMIT 1`,
        [key]
    );
    return rows[0] || null;
}
