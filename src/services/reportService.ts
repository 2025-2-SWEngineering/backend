import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import pool from "../config/database.js";

type ReportRow = {
  date: string;
  type: "income" | "expense";
  amount: number | string;
  description: string | null;
  receipt_url?: string | null;
};

async function fetchReportData(groupId: number, from: string, to: string) {
  const { rows: tx } = await pool.query<ReportRow>(
    `SELECT date, type, amount, description, receipt_url
     FROM transactions
     WHERE group_id = $1 AND date BETWEEN $2 AND $3
     ORDER BY date ASC, id ASC`,
    [groupId, from, to]
  );
  let totalIncome = 0;
  let totalExpense = 0;
  for (const t of tx as ReportRow[]) {
    if (t.type === "income") totalIncome += Number(t.amount);
    else totalExpense += Number(t.amount);
  }
  return {
    transactions: tx as ReportRow[],
    totalIncome,
    totalExpense,
    currentBalance: totalIncome - totalExpense,
  };
}

export async function buildReportPDF({ groupId, from, to }: { groupId: number; from: string; to: string }): Promise<Buffer> {
  const { transactions, totalIncome, totalExpense, currentBalance } = await fetchReportData(groupId, from, to);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (d: Buffer) => chunks.push(d));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("우리회계 - 기간 보고서", { align: "left" });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`기간: ${from} ~ ${to}`);
    doc.moveDown(0.5);
    doc.text(`총 수입: ${totalIncome.toLocaleString()}원`);
    doc.text(`총 지출: ${totalExpense.toLocaleString()}원`);
    doc.text(`현재 잔액: ${currentBalance.toLocaleString()}원`);
    doc.moveDown();
    doc.fontSize(14).text("거래 내역", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(10);
    transactions.forEach((t) => {
      const sign = t.type === "income" ? "+" : "-";
      doc.text(`${t.date}  ${sign}${Number(t.amount).toLocaleString()}원  ${t.description || "-"}`);
    });

    doc.end();
  });
}

export async function buildReportExcel({ groupId, from, to }: { groupId: number; from: string; to: string }): Promise<Buffer> {
  const { transactions, totalIncome, totalExpense, currentBalance } = await fetchReportData(groupId, from, to);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Summary");

  ws.columns = [
    { header: "날짜", key: "date", width: 12 },
    { header: "유형", key: "type", width: 10 },
    { header: "금액", key: "amount", width: 14 },
    { header: "설명", key: "description", width: 40 },
    { header: "영수증", key: "receipt", width: 40 },
  ];

  ws.addRow([]);
  ws.addRow([`기간: ${from} ~ ${to}`]);
  ws.addRow([`총 수입: ${totalIncome}`, `총 지출: ${totalExpense}`, `현재 잔액: ${currentBalance}`]);
  ws.addRow([]);
  ws.addRow(["거래 내역"]);
  ws.addRow([]);

  for (const t of transactions) {
    ws.addRow({
      date: t.date,
      type: t.type,
      amount: Number(t.amount),
      description: t.description || "-",
      receipt: t.receipt_url || "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
