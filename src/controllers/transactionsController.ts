import { Request, Response, NextFunction } from "express";
import { getUserGroupRole } from "../models/groupModel.js";
import {
  createTransaction,
  listTransactionsByGroup,
  getStatsByGroup,
  getMonthlyStatsByGroup,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
} from "../models/transactionModel.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as { groupId?: string; limit?: string; page?: string };
    const groupId = Number(q.groupId);
    const limit = Number(q.limit || 50);
    const page = Number(q.page || 1);
    const offset = (page - 1) * limit;
    if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const items = await listTransactionsByGroup(groupId, { limit, offset });
    res.json({ items, meta: { limit, page } });
  } catch (err) {
    next(err);
  }
}

export async function stats(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as { groupId?: string };
    const groupId = Number(q.groupId);
    if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const stats = await getStatsByGroup(groupId);
    res.json({ stats });
  } catch (err) {
    next(err);
  }
}

export async function monthly(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as { groupId?: string; months?: string };
    const groupId = Number(q.groupId);
    const months = q.months ? Number(q.months) : 6;
    if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const data = await getMonthlyStatsByGroup(groupId, months > 0 ? months : 6);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    type CreateBody = { groupId: number; type: "income" | "expense"; amount: number; description: string; date: string; receiptUrl?: string };
    const { groupId, type, amount, description, date, receiptUrl } = req.body as CreateBody;
    if (!groupId || !type || amount == null || !description || !date) {
      return res.status(400).json({ message: "groupId, type, amount, description, date는 필수입니다." });
    }
    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "type은 income|expense 만 허용됩니다." });
    }
    const role = await getUserGroupRole(req.user!.id, Number(groupId));
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    console.info("[transactions] create request", {
      userId: req.user?.id,
      groupId: Number(groupId),
      type,
      amount: Number(amount),
      hasReceipt: !!receiptUrl,
    });
    const tx = await createTransaction({
      groupId: Number(groupId),
      type,
      amount: Number(amount),
      description,
      date,
      receiptUrl,
      createdBy: req.user!.id,
    });
    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error("[transactions] create failed", err);
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    type UpdateBody = { groupId: number; type?: "income" | "expense"; amount?: number; description?: string; date?: string; receiptUrl?: string };
    const { groupId, type, amount, description, date, receiptUrl } = req.body as UpdateBody;
    if (!id || !groupId) return res.status(400).json({ message: "id, groupId가 필요합니다." });
    const tx = await getTransactionById(id);
    if (!tx || tx.group_id !== Number(groupId)) return res.status(404).json({ message: "거래를 찾을 수 없습니다." });
    const role = await getUserGroupRole(req.user!.id, Number(groupId));
    if (!role || (role !== "admin" && tx.created_by !== req.user!.id)) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }
    if (type && !["income", "expense"].includes(type)) {
      return res.status(400).json({ message: "type은 income|expense 만 허용됩니다." });
    }
    const updated = await updateTransaction(id, { type, amount, description, date, receiptUrl });
    res.json({ transaction: updated });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const q = req.query as unknown as { groupId?: string };
    const groupId = Number(q.groupId);
    if (!id || !groupId) return res.status(400).json({ message: "id, groupId가 필요합니다." });
    const tx = await getTransactionById(id);
    if (!tx || tx.group_id !== groupId) return res.status(404).json({ message: "거래를 찾을 수 없습니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role || (role !== "admin" && tx.created_by !== req.user!.id)) {
      return res.status(403).json({ message: "삭제 권한이 없습니다." });
    }
    await deleteTransaction(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}


