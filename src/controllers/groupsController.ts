import { Request, Response, NextFunction } from "express";
import {
    createGroup as createGroupModel,
    getGroupsForUser,
    getUserGroupRole,
    listGroupMembers,
    setUserGroupRole,
    countAdminsInGroup,
    countMembersInGroup,
    removeUserFromGroup,
    deleteGroup as deleteGroupModel,
} from "../models/groupModel.js";
import { createInvitation } from "../models/invitationModel.js";

export async function list(req: Request, res: Response, next: NextFunction) {
    try {
        const groups = await getGroupsForUser(req.user!.id);
        res.json({ groups });
    } catch (err) {
        next(err);
    }
}

export async function create(req: Request, res: Response, next: NextFunction) {
    try {
        const { name } = (req.body as { name?: string }) || {};
        if (!name) return res.status(400).json({ message: "그룹 이름은 필수입니다." });
        const group = await createGroupModel({ name, ownerUserId: req.user!.id });
        res.status(201).json({ group });
    } catch (err) {
        next(err);
    }
}

export async function createInvite(req: Request, res: Response, next: NextFunction) {
    try {
        const { groupId } = req.params as { groupId: string };
        const role = await getUserGroupRole(req.user!.id, Number(groupId));
        if (role !== "admin") return res.status(403).json({ message: "관리자 권한이 필요합니다." });
        const { ttlHours } = (req.body as { ttlHours?: number }) || {};
        const invite = await createInvitation({
            groupId: Number(groupId),
            createdBy: req.user!.id,
            ttlHours: ttlHours && Number(ttlHours) > 0 ? Number(ttlHours) : 72,
        });
        res.status(201).json({ invitation: invite });
    } catch (err) {
        next(err);
    }
}

export async function members(req: Request, res: Response, next: NextFunction) {
    try {
        const groupId = Number(req.params.groupId);
        if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
        const role = await getUserGroupRole(req.user!.id, groupId);
        if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
        const members = await listGroupMembers(groupId);
        res.json({ members });
    } catch (err) {
        next(err);
    }
}

export async function changeRole(req: Request, res: Response, next: NextFunction) {
    try {
        const groupId = Number(req.params.groupId);
        const targetUserId = Number(req.params.userId);
        const roleStr = String((req.body as { role?: string })?.role || "");
        if (!groupId || !targetUserId) return res.status(400).json({ message: "groupId, userId가 필요합니다." });
        if (!["admin", "member"].includes(roleStr)) return res.status(400).json({ message: "role은 admin|member 만 허용됩니다." });

        const requesterRole = await getUserGroupRole(req.user!.id, groupId);
        if (requesterRole !== "admin") return res.status(403).json({ message: "관리자 권한이 필요합니다." });

        const currentRole = await getUserGroupRole(targetUserId, groupId);
        if (!currentRole) return res.status(404).json({ message: "대상 사용자가 그룹에 없습니다." });

        if (currentRole === "admin" && roleStr === "member") {
            const adminCount = await countAdminsInGroup(groupId);
            if (adminCount <= 1) return res.status(400).json({ message: "마지막 관리자는 강등할 수 없습니다." });
        }

        const updated = await setUserGroupRole({ userId: targetUserId, groupId, role: roleStr as "admin" | "member" });
        return res.json({ member: updated });
    } catch (err) {
        next(err);
    }
}


export async function remove(req: Request, res: Response, next: NextFunction) {
    try {
        const groupId = Number(req.params.groupId);
        if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
        const role = await getUserGroupRole(req.user!.id, groupId);
        if (role !== "admin") return res.status(403).json({ message: "그룹 삭제는 관리자만 가능합니다." });
        await deleteGroupModel(groupId);
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
}

export async function leave(req: Request, res: Response, next: NextFunction) {
    try {
        const groupId = Number(req.params.groupId);
        if (!groupId) return res.status(400).json({ message: "groupId가 필요합니다." });
        const role = await getUserGroupRole(req.user!.id, groupId);
        if (!role) return res.status(404).json({ message: "이미 그룹에 속해있지 않습니다." });

        if (role === "admin") {
            const adminCount = await countAdminsInGroup(groupId);
            const memberCount = await countMembersInGroup(groupId);
            // 마지막 관리자면 탈퇴 제한(다른 멤버가 존재할 때)
            if (adminCount <= 1 && memberCount > 1) {
                return res.status(400).json({ message: "마지막 관리자는 다른 관리자를 지정하거나 그룹을 삭제해야 합니다." });
            }
        }

        await removeUserFromGroup({ userId: req.user!.id, groupId });
        return res.status(204).send();
    } catch (err) {
        next(err);
    }
}

