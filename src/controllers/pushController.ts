import { Request, Response, NextFunction } from "express";
import { savePushSubscription, deletePushSubscription } from "../models/pushSubscriptionModel.js";
import { getVapidPublicKey } from "../services/pushService.js";

// VAPID 공개 키 조회 (프론트엔드에서 구독 시 필요)
export async function getVapidKey(req: Request, res: Response, next: NextFunction) {
    try {
        const publicKey = getVapidPublicKey();
        if (!publicKey) {
            return res.status(503).json({ message: "푸시 알림이 설정되지 않았습니다." });
        }
        res.json({ publicKey });
    } catch (err) {
        next(err);
    }
}

// 푸시 구독 저장
export async function subscribe(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.id;
        const { subscription } = req.body as {
            subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
        };

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ message: "구독 정보가 올바르지 않습니다." });
        }

        await savePushSubscription(userId, subscription);
        res.json({ message: "푸시 구독이 저장되었습니다." });
    } catch (err) {
        next(err);
    }
}

// 푸시 구독 삭제
export async function unsubscribe(req: Request, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.id;
        const { endpoint } = req.body as { endpoint?: string };

        if (!endpoint) {
            return res.status(400).json({ message: "endpoint가 필요합니다." });
        }

        await deletePushSubscription(userId, endpoint);
        res.json({ message: "푸시 구독이 삭제되었습니다." });
    } catch (err) {
        next(err);
    }
}

