import { Request, Response, NextFunction } from "express";
import { getUserGroupRole } from "../models/groupModel.js";
import { buildReportPDF, buildReportExcel } from "../services/reportService.js";

function normalizeRange(req: Request) {
  const q = req.query as unknown as { groupId?: string; from?: string; to?: string };
  const groupId = Number(q.groupId);
  const from = q.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = q.to || new Date().toISOString().slice(0, 10);
  return { groupId, from, to };
}

export async function summaryPdf(req: Request, res: Response, next: NextFunction) {
  try {
    const { groupId, from, to } = normalizeRange(req);
    if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const buffer = await buildReportPDF({ groupId, from, to });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=report_${groupId}_${from}_${to}.pdf`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function summaryXlsx(req: Request, res: Response, next: NextFunction) {
  try {
    const { groupId, from, to } = normalizeRange(req);
    if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const buffer = await buildReportExcel({ groupId, from, to });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=report_${groupId}_${from}_${to}.xlsx`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}


