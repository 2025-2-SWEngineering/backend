import { Request, Response, NextFunction } from "express";
import { getUserGroupRole } from "../models/groupModel.js";
import { listDuesByGroup, setDuesStatus } from "../models/duesModel.js";

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as { groupId?: string };
    const groupId = Number(q.groupId);
    if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
    const role = await getUserGroupRole(req.user!.id, groupId);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    const items = await listDuesByGroup(groupId);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const { groupId, userId, isPaid } = req.body as { groupId?: number; userId?: number; isPaid?: boolean };
    if (!groupId || !userId || typeof isPaid !== "boolean") {
      return res.status(400).json({ message: "groupId, userId, isPaid는 필수입니다." });
    }
    const role = await getUserGroupRole(req.user!.id, Number(groupId));
    if (role !== "admin") return res.status(403).json({ message: "관리자 권한이 필요합니다." });
    const updated = await setDuesStatus({ groupId: Number(groupId), userId: Number(userId), isPaid });
    res.json({ item: updated });
  } catch (err) {
    next(err);
  }
}


