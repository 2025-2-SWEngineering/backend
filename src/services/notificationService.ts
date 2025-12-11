import pool from "../config/database.js";
import { insertNotificationLog } from "../models/notificationLogModel.js";
import { sendPushNotificationsToUsers } from "./pushService.js";

import {
  getFcmTokensByUserIds,
  deleteFcmTokensByToken,
} from "../models/fcmTokenModel.js";
import { sendToTokens } from "../services/fcmService.js";

export async function sendDuesReminder({
  toEmail,
  userName,
  groupName,
  unpaidCount,
}: {
  toEmail: string;
  userName: string;
  groupName: string;
  unpaidCount: number;
}): Promise<void> {
  // 실제 이메일/SMS 연동 대신 서버 로그로 대체
  // 연동 시 AWS SES, Slack, SMS 등 구현
  // eslint-disable-next-line no-console
  console.log(
    `[REMINDER] to=${toEmail} name=${userName} group=${groupName} unpaid=${unpaidCount}`
  );
}

export type UnpaidUserInfo = {
  group_id: number;
  group_name: string;
  user_id: number;
  user_name: string;
  email: string;
  unpaid_count: number;
  receive_dues_reminders: boolean | null;
};

export async function getUnpaidUsers(
  groupId: number
): Promise<UnpaidUserInfo[]> {
  const { rows } = await pool.query<UnpaidUserInfo>(
    `SELECT ug.group_id, g.name AS group_name, u.id AS user_id, u.name AS user_name, u.email,
              COUNT(*) FILTER (WHERE d.is_paid = false OR d.is_paid IS NULL) AS unpaid_count,
              up.receive_dues_reminders
       FROM user_groups ug
       JOIN users u ON u.id = ug.user_id
       JOIN groups g ON g.id = ug.group_id
       LEFT JOIN dues d ON d.group_id = ug.group_id AND d.user_id = ug.user_id
       LEFT JOIN user_preferences up ON up.user_id = u.id
       WHERE ug.group_id = $1
       GROUP BY ug.group_id, g.name, u.id, u.name, u.email, up.receive_dues_reminders`,
    [groupId]
  );
  return rows.map((r) => ({
    ...r,
    unpaid_count: Number(r.unpaid_count),
  }));
}

export type DuesReminderTestResult = {
  user_id: number;
  user_name: string;
  email: string;
  sent: boolean;
  reason?: string;
};

export async function testDuesRemindersForGroup(
  groupId: number
): Promise<DuesReminderTestResult[]> {
  const users = await getUnpaidUsers(groupId);
  const results: DuesReminderTestResult[] = [];

  for (const user of users) {
    const allow = user.receive_dues_reminders !== false; // default true

    if (!allow) {
      results.push({
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        sent: false,
        reason: "알림 설정이 비활성화되어 있습니다.",
      });
      continue;
    }

    if (user.unpaid_count === 0) {
      results.push({
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        sent: false,
        reason: "미납 내역이 없습니다.",
      });
      continue;
    }

    try {
      // 이메일 알림 발송
      await sendDuesReminder({
        toEmail: user.email,
        userName: user.user_name,
        groupName: user.group_name,
        unpaidCount: user.unpaid_count,
      });

      // 푸시 알림 발송
      try {
        await sendPushNotificationsToUsers([user.user_id], {
          title: "회비 납부 알림",
          body: `${user.group_name}: 미납 ${user.unpaid_count}건이 있습니다.`,
          data: {
            type: "dues_reminder",
            groupId: user.group_id,
            unpaidCount: user.unpaid_count,
          },
        });
      } catch (pushErr) {
        // 푸시 알림 실패는 무시 (이메일은 성공했으므로)
        // eslint-disable-next-line no-console
        console.warn(
          `Push notification failed for user ${user.user_id}:`,
          pushErr
        );
      }

      await insertNotificationLog({
        userId: user.user_id,
        groupId: user.group_id,
        type: "dues_reminder",
        message: `${user.group_name}: 미납 ${user.unpaid_count}건 안내 발송 (테스트)`,
      });

      results.push({
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        sent: true,
      });
    } catch (err) {
      results.push({
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        sent: false,
        reason: err instanceof Error ? err.message : "알 수 없는 오류",
      });
    }
  }

  return results;
}

export async function sendTransactionCreatedNotification(params: {
  targetUserIds: number[]; // 알림 받을 유저들
  groupId: number; // 소속 그룹 ID
  transactionId: number; // 거래 ID
  titleText?: string; // 알림 제목 (optional)
  bodyText?: string; // 알림 본문 (optional) - "카테고리 - 금액원" 등
}) {
  const { targetUserIds, groupId, transactionId, titleText, bodyText } = params;

  if (!targetUserIds || targetUserIds.length === 0) return;

  // 1) FCM 토큰 조회
  const tokens = await getFcmTokensByUserIds(targetUserIds);
  if (tokens.length === 0) return;

  // 2) groupId 로 groupName 조회
  let groupName: string | undefined;
  try {
    const { rows } = await pool.query<{ name: string }>(
      `SELECT name FROM groups WHERE id = $1 LIMIT 1`,
      [groupId]
    );
    groupName = rows[0]?.name;
  } catch (e) {
    console.error("[FCM] 그룹 이름 조회 실패:", e);
  }

  // 3) 제목/본문 기본값
  const baseTitle = titleText || "수입이 등록되었습니다";
  const baseBody = bodyText || ""; // "카테고리 - 금액원" 이런 텍스트를 여기로 넘겨도 됨

  // 4) notification + data 구성
  const notificationTitle = groupName
    ? `[${groupName}] ${baseTitle}`
    : baseTitle;

  const payload = {
    notification: {
      title: notificationTitle,
      body: baseBody,
    },
    data: {
      type: "transaction_created",
      groupId: String(groupId),
      transactionId: String(transactionId),

      // 프론트/서비스워커에서 사용할 groupName, title/body
      ...(groupName ? { groupName } : {}),
      title: baseTitle,
      body: baseBody,
    },
  };

  const result = await sendToTokens(tokens, payload);

  // 유효하지 않은 토큰 정리
  if (result.invalidTokens && result.invalidTokens.length > 0) {
    await deleteFcmTokensByToken(result.invalidTokens);
  }

  console.log(
    `[FCM] transaction_created sent. success=${result.successCount}, fail=${result.failureCount}`
  );
}
