import admin from "firebase-admin";

// Firebase Admin SDK를 사용해 FCM 전송을 담당하는 서비스입니다.
// 환경변수로 서비스 계정 정보를 받습니다.

// 환경변수에서 값 읽기
const projectId = process.env.FIREBASE_PROJECT_ID || "";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || "";
const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || "";

// privateKey는 줄바꿈이 \n 인식 형태로 들어올 수 있으므로 변환
const privateKey = privateKeyRaw ? privateKeyRaw.replace(/\\n/g, "\n") : "";

// 관리자 초기화는 한 번만 수행
let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  if (!projectId || !clientEmail || !privateKey) {
    // 개발환경에서 누락 시 로그만 남기고 동작을 막지 않음
    // 실제 전송 시에는 에러가 발생함
    // eslint-disable-next-line no-console
    console.warn(
      "[FCM] Firebase 서비스 계정 정보가 완전하지 않습니다. FCM 전송이 실패할 수 있습니다."
    );
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      } as unknown as admin.ServiceAccount),
    });
    initialized = true;
  } catch (e) {
    // 이미 초기화된 경우 에러가 날 수 있음 — 무시
  }
}

// 전송 결과을 요약해 반환합니다.
export type FcmSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[]; // 제거가 권장되는 토큰 목록
};

// 최대 500개 토큰씩 전송해야 함
const CHUNK_SIZE = 500;

/**
 * FCM으로 여러 토큰에 알림을 전송합니다.
 * - payload는 `notification` 및 `data` 필드를 포함할 수 있습니다.
 * - 실패 응답에서 토큰 삭제 대상(invalid)을 수집하여 반환합니다.
 */
export async function sendToTokens(
  tokens: string[],
  payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }
): Promise<FcmSendResult> {
  ensureInitialized();

  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  let successCount = 0;
  let failureCount = 0;
  const invalidTokens: string[] = [];

  // 토큰을 CHUNK_SIZE 단위로 분할
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const message: admin.messaging.MulticastMessage = {
      tokens: chunk,
      notification: payload.notification,
      data: payload.data,
    };

    try {
      // firebase-admin의 메시징 타입 정의 문제로 인한 타입 회피
      // 런타임에서는 정상 동작하므로 any로 캐스팅해 호출
      const messaging = admin.messaging() as any;
      const resp = await messaging.sendMulticast(message);
      successCount += resp.successCount;
      failureCount += resp.failureCount;

      // 실패한 응답 중 token 관련 에러는 제거 대상으로 표시
      for (let j = 0; j < resp.responses.length; j++) {
        const r = resp.responses[j];
        if (!r.success) {
          const err = r.error;
          // 대표적인 등록되지 않음 에러는 제거 권장
          if (
            err &&
            (err.code === "messaging/registration-token-not-registered" ||
              err.code === "messaging/invalid-registration-token")
          ) {
            invalidTokens.push(chunk[j]);
          }
        }
      }
    } catch (err) {
      // 전체 전송 실패시 chunk는 실패로 간주
      failureCount += chunk.length;
      // eslint-disable-next-line no-console
      console.error("[FCM] sendMulticast failed:", err);
    }
  }

  return { successCount, failureCount, invalidTokens };
}
/**
 * Subscribe given tokens to a topic (e.g., `group_123`).
 */
export async function subscribeTokensToTopic(
  tokens: string[],
  topic: string
): Promise<{ successCount: number; failureCount: number }> {
  ensureInitialized();
  if (!tokens || tokens.length === 0)
    return { successCount: 0, failureCount: 0 };
  try {
    const resp = await admin.messaging().subscribeToTopic(tokens, topic);
    return {
      successCount: resp.successCount || 0,
      failureCount: resp.failureCount || 0,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[FCM] subscribeToTopic failed:", err);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Unsubscribe given tokens from a topic
 */
export async function unsubscribeTokensFromTopic(
  tokens: string[],
  topic: string
): Promise<{ successCount: number; failureCount: number }> {
  ensureInitialized();
  if (!tokens || tokens.length === 0)
    return { successCount: 0, failureCount: 0 };
  try {
    const resp = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    return {
      successCount: resp.successCount || 0,
      failureCount: resp.failureCount || 0,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[FCM] unsubscribeFromTopic failed:", err);
    return { successCount: 0, failureCount: tokens.length };
  }
}

/**
 * Send a message to a topic (e.g., `group_123`).
 */
export async function sendToTopic(
  topic: string,
  payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }
): Promise<{ messageId?: string } | null> {
  ensureInitialized();
  try {
    const message: admin.messaging.Message = {
      topic,
      notification: payload.notification,
      data: payload.data,
    } as unknown as admin.messaging.Message;
    const resp = await admin.messaging().send(message as any);
    return { messageId: resp };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[FCM] sendToTopic failed:", err);
    return null;
  }
}

export default {
  sendToTokens,
  subscribeTokensToTopic,
  unsubscribeTokensFromTopic,
  sendToTopic,
};
