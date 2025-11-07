import webpush from "web-push";
import {
    getPushSubscriptionsByUserIds,
    PushSubscriptionRow,
} from "../models/pushSubscriptionModel.js";

// VAPID 키는 환경 변수에서 가져오거나 생성
// 개발 환경에서는 한 번 생성해서 .env에 저장
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@woori-accounting.com";

// VAPID 키 설정
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
    // eslint-disable-next-line no-console
    console.warn(
        "[경고] VAPID 키가 설정되지 않았습니다. 푸시 알림을 사용하려면 VAPID_PUBLIC_KEY와 VAPID_PRIVATE_KEY를 설정하세요."
    );
    // eslint-disable-next-line no-console
    console.warn(
        "VAPID 키 생성: node scripts/generate-vapid-keys.js"
    );
}

export function getVapidPublicKey(): string {
    return VAPID_PUBLIC_KEY;
}

export function isPushEnabled(): boolean {
    return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export type PushNotificationPayload = {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
};

async function sendPushNotification(
    subscription: PushSubscriptionRow,
    payload: PushNotificationPayload
): Promise<void> {
    const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
        },
    };

    const notificationPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon || "/pwa-192x192.png",
        badge: payload.badge || "/pwa-192x192.png",
        data: payload.data || {},
    });

    try {
        await webpush.sendNotification(pushSubscription, notificationPayload);
    } catch (error) {
        // 구독이 만료되었거나 유효하지 않은 경우 에러 발생
        // 이 경우 구독 정보를 삭제해야 할 수도 있음
        if (error instanceof Error) {
            // 410 Gone: 구독이 만료됨
            // 404 Not Found: 구독이 존재하지 않음
            if (
                "statusCode" in error &&
                (error.statusCode === 410 || error.statusCode === 404)
            ) {
                // 구독 삭제는 호출하는 쪽에서 처리하도록 함
                throw new Error(`Invalid subscription: ${error.message}`);
            }
        }
        throw error;
    }
}

export async function sendPushNotificationsToUsers(
    userIds: number[],
    payload: PushNotificationPayload
): Promise<{ sent: number; failed: number; errors: Array<{ userId: number; error: string }> }> {
    if (!isPushEnabled()) {
        throw new Error("Push notifications are not enabled. Please set VAPID keys.");
    }

    if (userIds.length === 0) {
        return { sent: 0, failed: 0, errors: [] };
    }

    const subscriptions = await getPushSubscriptionsByUserIds(userIds);
    const errors: Array<{ userId: number; error: string }> = [];
    let sent = 0;
    let failed = 0;

    // 각 구독에 대해 푸시 알림 발송
    for (const subscription of subscriptions) {
        try {
            await sendPushNotification(subscription, payload);
            sent++;
        } catch (error) {
            failed++;
            errors.push({
                userId: subscription.user_id,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }

    return { sent, failed, errors };
}

