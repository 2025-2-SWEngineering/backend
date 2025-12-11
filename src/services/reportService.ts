import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3, BUCKET } from "../config/storageConfig.js";
import { Readable } from "stream";
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
  if (!tx || tx.length === 0) {
    throw new Error("NO_DATA_FOUND");
  }

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

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

async function loadFontFromS3IfConfigured(): Promise<Buffer | null> {
  try {
    const key = process.env.PDF_FONT_S3_KEY || "";
    if (!key || !BUCKET) return null;
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = res.Body as Readable | undefined;
    if (!body) return null;
    const buf = await streamToBuffer(body);
    return buf;
  } catch {
    return null;
  }
}

export async function buildReportPDF({ groupId, from, to }: { groupId: number; from: string; to: string }): Promise<Buffer> {
  const { transactions, totalIncome, totalExpense, currentBalance } = await fetchReportData(groupId, from, to);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  
  // Font Loading
  try {
    const envFont = process.env.PDF_FONT_PATH;
    const defaultCandidate = path.resolve(process.cwd(), "assets", "fonts", "NanumGothic.ttf");
    const fontPath = envFont && fs.existsSync(envFont) ? envFont : fs.existsSync(defaultCandidate) ? defaultCandidate : "";
    if (fontPath) {
      doc.registerFont("body", fontPath);
      doc.font("body");
    } else {
      const s3Font = await loadFontFromS3IfConfigured();
      if (s3Font) {
        doc.registerFont("body", s3Font);
        doc.font("body");
      } else {
        console.warn("[report] PDF font not found. Korean glyphs may not render.");
      }
    }
  } catch {
    // ignore
  }

  const fmtCurrency = (n: number) => `${Number(n).toLocaleString("ko-KR")}원`;
  const fmtDate = (d: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date(d).toISOString().slice(0, 10));

  return await new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (d: Buffer) => chunks.push(d));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // --- 1. Header Section ---
    // Blue background header
    doc.rect(0, 0, 595.28, 120).fill("#1a73e8"); // Google Blue style
    
    // Title
    doc.fillColor("white");
    doc.fontSize(26).text("재정 보고서", 0, 40, { align: "center" });
    doc.fontSize(12).text(`기간: ${from} ~ ${to}`, 0, 80, { align: "center" });
    
    doc.fillColor("black"); // Reset text color

    // --- 2. Summary Section ---
    const summaryY = 150;
    const cardWidth = 150;
    const cardHeight = 80;
    const gap = 20;
    const startX = (595.28 - (cardWidth * 3 + gap * 2)) / 2; // Center alignment

    const drawSummaryCard = (x: number, title: string, amount: string, color: string) => {
      // Card Shadow (simple gray rect offset)
      doc.roundedRect(x + 2, summaryY + 2, cardWidth, cardHeight, 5).fill("#e0e0e0");
      // Card Background
      doc.roundedRect(x, summaryY, cardWidth, cardHeight, 5).fill("white");
      doc.roundedRect(x, summaryY, cardWidth, cardHeight, 5).stroke("#cccccc");
      
      // Content
      doc.fillColor("#666666").fontSize(10).text(title, x, summaryY + 15, { width: cardWidth, align: "center" });
      doc.fillColor(color).fontSize(16).text(amount, x, summaryY + 40, { width: cardWidth, align: "center" });
    };

    drawSummaryCard(startX, "총 수입", fmtCurrency(totalIncome), "#28a745"); // Green
    drawSummaryCard(startX + cardWidth + gap, "총 지출", fmtCurrency(totalExpense), "#dc3545"); // Red
    drawSummaryCard(startX + (cardWidth + gap) * 2, "현재 잔액", fmtCurrency(currentBalance), "#1a73e8"); // Blue

    // --- 3. Transactions Table ---
    let y = 260; // Start below summary
    const tableTop = 260;
    const colX = { date: 50, type: 130, desc: 190, amount: 450 };
    const colWidth = { date: 80, type: 60, desc: 250, amount: 100 };
    
    // Table Title
    doc.fillColor("#333").fontSize(14).text("상세 거래 내역", 50, y - 30);

    const drawTableHeader = (currentY: number) => {
      doc.rect(40, currentY, 515, 25).fill("#f8f9fa"); // Header bg
      doc.fillColor("#495057").fontSize(10).font("Helvetica-Bold"); // Use bold if available, or fall back
      try { doc.font("body"); } catch {} // Restore korean font if needed, but headers are simple
      
      // We need bold font for headers, but let's stick to "body" to ensure Korean works if we change headers to Korean
      doc.font("body"); 
      
      doc.text("날짜", colX.date, currentY + 7);
      doc.text("구분", colX.type, currentY + 7);
      doc.text("내역", colX.desc, currentY + 7);
      doc.text("금액", colX.amount, currentY + 7, { width: colWidth.amount, align: "right" });
      
      // Divider line
      doc.moveTo(40, currentY + 25).lineTo(555, currentY + 25).strokeColor("#dee2e6").stroke();
      return currentY + 30;
    };

    y = drawTableHeader(y);

    doc.font("body").fontSize(10);
    
    transactions.forEach((t, i) => {
      // Pagination Check
      if (y > 750) {
        doc.addPage();
        y = 50; // Reset Y
        y = drawTableHeader(y); // Draw header again
      }

      // Zebra Striping
      if (i % 2 === 0) {
        doc.rect(40, y - 5, 515, 25).fill("#fcfcfc");
      }

      // Content
      doc.fillColor("#333");
      doc.text(fmtDate(t.date), colX.date, y);
      
      const typeText = t.type === "income" ? "수입" : "지출";
      const typeColor = t.type === "income" ? "#28a745" : "#dc3545";
      
      doc.fillColor(typeColor).text(typeText, colX.type, y);
      
      doc.fillColor("#333").text(t.description || "-", colX.desc, y, { width: colWidth.desc, lineBreak: false, ellipsis: true });
      
      const sign = t.type === "income" ? "+" : "-";
      const amountStr = `${sign} ${Number(t.amount).toLocaleString("ko-KR")}`;
      doc.fillColor(typeColor).text(amountStr, colX.amount, y, { width: colWidth.amount, align: "right" });

      // Bottom line for row
      doc.moveTo(40, y + 20).lineTo(555, y + 20).strokeColor("#f1f3f5").lineWidth(0.5).stroke();
      
      y += 25; // Row height
    });

    // --- 4. Footer ---
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fillColor("#999").fontSize(9).text(
        `${i + 1} / ${pageCount}`,
        0,
        doc.page.height - 30,
        { align: "center" }
      );
    }

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
