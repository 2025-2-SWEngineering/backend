import { Request, Response, NextFunction } from "express";
import { getInvitationByCode, markInvitationAccepted } from "../models/invitationModel.js";
import pool from "../config/database.js";

export async function accept(req: Request, res: Response, next: NextFunction) {
  try {
    const { code } = (req.body as { code?: string }) || {};
    if (!code) return res.status(400).json({ message: "초대 코드가 필요합니다." });
    const invite = await getInvitationByCode(code);
    if (!invite) return res.status(404).json({ message: "유효하지 않은 초대 코드입니다." });
    if (invite.accepted_at) return res.status(409).json({ message: "이미 사용된 초대 코드입니다." });
    if (new Date(invite.expires_at).getTime() < Date.now()) return res.status(410).json({ message: "초대 코드가 만료되었습니다." });
    await pool.query(
      `INSERT INTO user_groups (user_id, group_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, group_id) DO NOTHING`,
      [req.user!.id, invite.group_id, "member"]
    );
    await markInvitationAccepted({ id: invite.id, userId: req.user!.id });
    return res.json({ message: "그룹에 가입되었습니다.", groupId: invite.group_id });
  } catch (err) {
    next(err);
  }
}


