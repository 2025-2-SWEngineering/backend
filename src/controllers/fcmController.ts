import { Request, Response, NextFunction } from "express";
import {
  saveFcmToken,
  deleteFcmToken,
  getFcmTokensByUserIds,
  deleteFcmTokensByToken,
} from "../models/fcmTokenModel.js";
import { sendToTokens } from "../services/fcmService.js";
import pool from "../config/database.js";

import { sendTransactionCreatedNotification } from "../services/notificationService.js";

// 클라이언트에서 받은 FCM 토큰을 저장합니다.
export async function registerToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id as number;
    const { token, platform } = req.body as {
      token?: string;
      platform?: string;
    };

    if (!token) {
      return res.status(400).json({ message: "token이 필요합니다." });
    }

    await saveFcmToken({
      userId,
      token,
      platform: platform || "web",
    });

    res.json({ message: "FCM 토큰이 등록되었습니다." });
  } catch (err) {
    next(err);
  }
}

// FCM 토큰 삭제
export async function unregisterToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id as number;
    const { token } = req.body as { token?: string };

    if (!token) {
      return res.status(400).json({ message: "token이 필요합니다." });
    }

    await deleteFcmToken({ userId, token });
    res.json({ message: "FCM 토큰이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}

// 관리자 전용: 지정한 사용자들에게 테스트 알림 전송 (group 정보 포함, data-only)
export async function sendTest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id as number;
    const { rows } = await pool.query<{ role: string }>(
      `SELECT role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );
    const role = rows[0]?.role;
    if (role !== "admin") {
      return res.status(403).json({ message: "관리자 권한이 필요합니다." });
    }

    const body = req.body as {
      userIds?: number[];
      title?: string;
      body?: string;
      data?: Record<string, string>;
      groupId?: number;
    };

    if (!body.userIds || body.userIds.length === 0) {
      return res.status(400).json({ message: "userIds가 필요합니다." });
    }

    const tokens = await getFcmTokensByUserIds(body.userIds);
    if (tokens.length === 0) {
      return res.json({ sent: 0, message: "대상 토큰이 없습니다." });
    }

    // groupId 가 있으면 groupName 조회해서 data에 추가
    let extraData: Record<string, string> = {};
    if (body.groupId) {
      try {
        const result = await pool.query<{ name: string }>(
          `SELECT name FROM groups WHERE id = $1 LIMIT 1`,
          [body.groupId]
        );
        const groupName = result.rows[0]?.name;
        if (groupName) {
          extraData.groupId = String(body.groupId);
          extraData.groupName = groupName;
        } else {
          extraData.groupId = String(body.groupId);
        }
      } catch (e) {
        // 그룹 이름 못 가져와도 알림 자체는 가게끔 groupId만 세팅
        extraData.groupId = String(body.groupId);
      }
    }

    // 🔥 data-only payload: title/body + groupId/groupName 모두 data에 실어 보냄
    const payload = {
      data: {
        title: body.title || "테스트 알림",
        body: body.body || "테스트 메시지입니다.",
        ...(body.data || {}),
        ...extraData,
      },
    };

    const result = await sendToTokens(tokens, payload);

    if (result.invalidTokens && result.invalidTokens.length > 0) {
      await deleteFcmTokensByToken(result.invalidTokens);
    }

    res.json({
      sent: result.successCount,
      failed: result.failureCount,
      removed_tokens: result.invalidTokens,
    });
  } catch (err) {
    next(err);
  }
}

// 특정 토큰이 이미 등록되어 있는지 확인 (옵션용)
export async function checkTokenRegistered(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id as number;
    const { token } = req.body as { token?: string };

    if (!token) {
      return res.status(400).json({ message: "token이 필요합니다." });
    }

    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM fcm_tokens 
       WHERE user_id = $1 AND token = $2 LIMIT 1`,
      [userId, token]
    );
    const exists = Number(rows[0]?.count || 0) > 0;
    return res.json({ exists });
  } catch (err) {
    next(err);
  }
}
