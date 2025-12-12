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
  getCategoryStatsByGroup,
} from "../models/transactionModel.js";
import { sendToTopic } from "../services/fcmService.js";
import pool from "../config/database.js"; // ✅ 그룹 이름 조회를 위해 추가

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as {
      groupId?: string;
      limit?: string;
      page?: string;
    };
    const groupId = Number(q.groupId);
    const limit = Number(q.limit || 50);
    const page = Number(q.page || 1);
    const offset = (page - 1) * limit;
    if (!groupId)
      return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role)
      return res
        .status(403)
        .json({ message: "해당 그룹에 대한 권한이 없습니다." });
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
    if (!groupId)
      return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role)
      return res
        .status(403)
        .json({ message: "해당 그룹에 대한 권한이 없습니다." });
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
    if (!groupId)
      return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role)
      return res
        .status(403)
        .json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const data = await getMonthlyStatsByGroup(groupId, months > 0 ? months : 6);
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function byCategory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const q = req.query as unknown as {
      groupId?: string;
      from?: string;
      to?: string;
    };
    const groupId = Number(q.groupId);
    const from = q.from || undefined;
    const to = q.to || undefined;
    if (!groupId)
      return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role)
      return res
        .status(403)
        .json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const data = await getCategoryStatsByGroup({ groupId, from, to });
    res.json({ data });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    type CreateBody = {
      groupId: number;
      type: "income" | "expense";
      amount: number;
      description: string;
      date: string;
      receiptUrl?: string;
      category?: string;
    };
    const { groupId, type, amount, description, date, receiptUrl, category } =
      req.body as CreateBody;
    if (!groupId || !type || amount == null || !description || !date) {
      return res.status(400).json({
        message: "groupId, type, amount, description, date는 필수입니다.",
      });
    }
    if (!["income", "expense"].includes(type)) {
      return res
        .status(400)
        .json({ message: "type은 income|expense 만 허용됩니다." });
    }
    const role = await getUserGroupRole(req.user!.id, Number(groupId));
    if (!role)
      return res
        .status(403)
        .json({ message: "해당 그룹에 대한 권한이 없습니다." });
    console.info("[transactions] create request", {
      userId: req.user?.id,
      groupId: Number(groupId),
      type,
      amount: Number(amount),
      hasReceipt: !!receiptUrl,
      hasCategory: !!(category && String(category).trim()),
    });
    const tx = await createTransaction({
      groupId: Number(groupId),
      type,
      amount: Number(amount),
      description,
      date,
      receiptUrl,
      createdBy: req.user!.id,
      category:
        category && String(category).trim() ? String(category).trim() : null,
    });

    // ✅ FCM: 그룹 이름까지 포함해서 토픽 알림 전송 (논블로킹)
    try {
      // 1) 그룹 이름 조회
      let groupName: string | undefined;
      try {
        const { rows } = await pool.query<{ name: string }>(
          `SELECT name FROM groups WHERE id = $1 LIMIT 1`,
          [tx.group_id]
        );
        groupName = rows[0]?.name;
      } catch (e) {
        // 그룹 이름 못 가져와도 알림은 보내되, 이름만 없는 상태로 보냄
        // eslint-disable-next-line no-console
        console.warn("[FCM] failed to fetch group name for transaction", e);
      }

      // 2) 제목/본문 구성
      const baseTitle =
        type === "income" ? "수입이 등록되었습니다" : "지출이 등록되었습니다";
      const bodyText = `${tx.description} - ${tx.amount.toLocaleString()}원`;

      // 그룹 이름이 있으면 [그룹명] 붙이기
      const notificationTitle = groupName
        ? `[${groupName}] ${baseTitle}`
        : baseTitle;

      // 3) 토픽으로 전송 (notification + data)
      await sendToTopic(`group_${tx.group_id}`, {
        notification: { title: notificationTitle, body: bodyText },
        data: {
          type: "transaction_created",
          groupId: String(tx.group_id),
          transactionId: String(tx.id),
          // 프론트/서비스워커에서 활용할 수 있도록 groupName도 data에 실어줌
          ...(groupName ? { groupName } : {}),
          // 필요하면 data.title/body도 같이 넣어두면 좋음
          title: baseTitle,
          body: bodyText,
        },
      });
    } catch (e) {
      // don't block the main response on notification errors
      // eslint-disable-next-line no-console
      console.warn(
        "[FCM] failed to send topic notification for transaction",
        e
      );
    }

    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error("[transactions] create failed", err);
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    type UpdateBody = {
      groupId: number;
      type?: "income" | "expense";
      amount?: number;
      description?: string;
      date?: string;
      receiptUrl?: string;
      category?: string;
    };
    const { groupId, type, amount, description, date, receiptUrl, category } =
      req.body as UpdateBody;
    if (!id || !groupId)
      return res.status(400).json({ message: "id, groupId가 필요합니다." });
    const tx = await getTransactionById(id);
    if (!tx || tx.group_id !== Number(groupId))
      return res.status(404).json({ message: "거래를 찾을 수 없습니다." });
    const role = await getUserGroupRole(req.user!.id, Number(groupId));
    if (!role || (role !== "admin" && tx.created_by !== req.user!.id)) {
      return res.status(403).json({ message: "수정 권한이 없습니다." });
    }
    if (type && !["income", "expense"].includes(type)) {
      return res
        .status(400)
        .json({ message: "type은 income|expense 만 허용됩니다." });
    }
    const updated = await updateTransaction(id, {
      type,
      amount,
      description,
      date,
      receiptUrl,
      category,
    });
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
    if (!id || !groupId)
      return res.status(400).json({ message: "id, groupId가 필요합니다." });
    const tx = await getTransactionById(id);
    if (!tx || tx.group_id !== groupId)
      return res.status(404).json({ message: "거래를 찾을 수 없습니다." });
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
