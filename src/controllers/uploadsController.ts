import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getTransactionById, getTransactionByReceiptKey, type TransactionRow } from "../models/transactionModel.js";
import { getUserGroupRole } from "../models/groupModel.js";
import { s3, BUCKET, STORAGE_MODE, AWS_REGION } from "../config/storageConfig.js";
import { issueS3PutPresign, saveLocalFile } from "../services/storageService.js";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export function mode(_req: Request, res: Response) {
  res.json({ mode: STORAGE_MODE });
}

export async function presignPut(req: Request, res: Response, next: NextFunction) {
  try {
    if (STORAGE_MODE !== "s3") {
      return res.status(503).json({ message: "현재 로컬 저장 모드입니다. /uploads/direct를 사용하세요." });
    }
    const { filename, contentType } = (req.body as { filename?: string; contentType?: string }) || {};
    if (!filename || !contentType) return res.status(400).json({ message: "filename, contentType가 필요합니다." });
    const { url, key, contentType: normalized } = await issueS3PutPresign({ userId: req.user!.id, filename, contentType });
    try {
      const host = new URL(url).host;
      console.info("[uploads] presign issued", { userId: req.user?.id, key, contentType: normalized, bucket: BUCKET, region: AWS_REGION, host });
    } catch {
      console.info("[uploads] presign issued", { userId: req.user?.id, key, contentType: normalized, bucket: BUCKET, region: AWS_REGION });
    }
    res.json({ url, key, contentType: normalized });
  } catch (err) {
    console.error("[uploads] presign error", err);
    next(err);
  }
}

export async function direct(req: Request, res: Response, next: NextFunction) {
  try {
    if (STORAGE_MODE !== "local") {
      return res.status(503).json({ message: "현재 S3 저장 모드입니다. /uploads/presign/put를 사용하세요." });
    }
    if (!req.file) return res.status(400).json({ message: "파일이 필요합니다." });
    const original = req.file.originalname || "file";
    const { key } = await saveLocalFile({ userId: req.user!.id, originalname: original, buffer: req.file.buffer });
    const url = `${req.protocol}://${req.headers.host}/files/${key.replace(/\\/g, "/")}`;
    console.info("[uploads] local stored", { userId: req.user?.id, key, url });
    return res.json({ url, key, contentType: req.file.mimetype || "application/octet-stream" });
  } catch (err) {
    console.error("[uploads] local upload error", err);
    next(err);
  }
}

export async function presignGet(req: Request, res: Response, next: NextFunction) {
  try {
    const q = req.query as unknown as { transactionId?: string; key?: string };
    const transactionId = q.transactionId ? Number(q.transactionId) : undefined;
    const fallbackKey = q.key ? String(q.key) : undefined;
    let tx: (TransactionRow | Pick<TransactionRow, "id" | "group_id" | "receipt_url">) | null = null;
    if (transactionId) tx = await getTransactionById(transactionId);
    else if (fallbackKey) tx = await getTransactionByReceiptKey(fallbackKey);
    if (!tx || !tx.receipt_url) return res.status(404).json({ message: "영수증이 존재하지 않습니다." });
    const role = await getUserGroupRole(req.user!.id, tx.group_id);
    if (!role) return res.status(403).json({ message: "해당 그룹에 대한 권한이 없습니다." });
    if (STORAGE_MODE === "local") {
      const v = String(tx.receipt_url);
      if (/^https?:\/\//i.test(v)) return res.json({ url: v });
      const url = `${req.protocol}://${req.headers.host}/files/${v.replace(/\\/g, "/")}`;
      return res.json({ url });
    }
    if (!BUCKET) return res.status(500).json({ message: "S3 버킷이 설정되지 않았습니다." });
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: tx.receipt_url });
    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    return res.json({ url });
  } catch (err) {
    next(err);
  }
}


