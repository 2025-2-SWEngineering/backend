import { Request, Response, NextFunction } from "express";
import {
  saveFcmToken,
  deleteFcmToken,
  getFcmTokensByUserIds,
  deleteFcmTokensByToken,
} from "../models/fcmTokenModel.js";
import {
  sendToTokens,
  subscribeTokensToTopic,
} from "../services/fcmService.js";
import { getGroupsForUser } from "../models/groupModel.js";
import pool from "../config/database.js";

// 클라이언트에서 받은 FCM 토큰을 저장합니다.
export async function registerToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { token, platform } = req.body as {
      token?: string;
      platform?: string;
    };
    if (!token) {
      return res.status(400).json({ message: "token이 필요합니다." });
    }

    await saveFcmToken(userId, token, platform);
    // subscribe this token to topics for groups the user already belongs to
    try {
      const groups = await getGroupsForUser(userId);
      if (groups && groups.length > 0) {
        const topics = groups.map((g) => `group_${g.id}`);
        // subscribe token to each topic (subscribeToTopic accepts array of tokens)
        for (const topic of topics) {
          try {
            await subscribeTokensToTopic([token], topic);
          } catch (e) {
            // ignore per-topic errors
            // eslint-disable-next-line no-console
            console.warn("[FCM] failed to subscribe token to topic", topic, e);
          }
        }
      }
    } catch (e) {
      // ignore group fetch/subscribe errors
      // eslint-disable-next-line no-console
      console.warn("[FCM] failed to auto-subscribe token to user groups", e);
    }
    res.json({ message: "FCM 토큰이 등록되었습니다." });
  } catch (err) {
    next(err);
  }
}

// 사용자 토큰 삭제
export async function unregisterToken(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { token } = req.body as { token?: string };
    if (!token) {
      return res.status(400).json({ message: "token이 필요합니다." });
    }

    await deleteFcmToken(userId, token);
    res.json({ message: "FCM 토큰이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}

// 관리자 전용: 지정한 사용자들에게 테스트 알림 전송
export async function sendTest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // 관리자 권한 확인: 간단히 users 테이블의 role이 'admin'인지 확인
    const userId = req.user!.id;
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
    };
    if (!body.userIds || body.userIds.length === 0) {
      return res.status(400).json({ message: "userIds가 필요합니다." });
    }

    const tokens = await getFcmTokensByUserIds(body.userIds);
    if (tokens.length === 0) {
      return res.json({ sent: 0, message: "대상 토큰이 없습니다." });
    }

    const payload = {
      notification: {
        title: body.title || "테스트 알림",
        body: body.body || "테스트 메시지입니다.",
      },
      data: body.data || {},
    };

    const result = await sendToTokens(tokens, payload);

    // 유효하지 않은 토큰이 있으면 DB에서 삭제
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
