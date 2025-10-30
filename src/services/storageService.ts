import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import path from "path";
import { s3, BUCKET, LOCAL_UPLOAD_DIR, ALLOWED_MIME_TYPES, ALLOWED_EXTENSIONS } from "../config/storageConfig.js";

type AllowedMime = (typeof ALLOWED_MIME_TYPES)[number];
type AllowedExt = (typeof ALLOWED_EXTENSIONS)[number];

export function normalizeMimeByExtension(contentType?: string, ext?: string): string {
    if (contentType) return contentType;
    const e = (ext || "").toLowerCase();
    if (e === "jpg" || e === "jpeg") return "image/jpeg";
    if (e === "png") return "image/png";
    if (e === "pdf") return "application/pdf";
    return "application/octet-stream";
}

export function isAllowedUpload(contentType?: string, ext?: string): boolean {
  const okType = ALLOWED_MIME_TYPES.includes((contentType || "") as AllowedMime);
  const okExt = ALLOWED_EXTENSIONS.includes(((ext || "").toLowerCase() as string) as AllowedExt);
    return okType || okExt;
}

export async function issueS3PutPresign({ userId, filename, contentType }: { userId: number; filename: string; contentType: string }) {
    if (!BUCKET) throw new Error("S3 버킷이 설정되지 않았습니다.");
    const ext = (filename.split(".").pop() || "bin").toLowerCase();
  if (!isAllowedUpload(contentType, ext)) {
    const err = new Error("허용되지 않은 Content-Type 입니다.") as Error & { status: number };
    err.status = 400;
    throw err;
  }
  const normalized = ALLOWED_MIME_TYPES.includes((contentType as AllowedMime))
    ? contentType
    : normalizeMimeByExtension(contentType, ext);
    const key = `receipts/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: normalized });
    const url = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    return { url, key, contentType: normalized };
}

export async function saveLocalFile({ userId, originalname, buffer }: { userId: number; originalname: string; buffer: Buffer }) {
    const ext = (originalname.split(".").pop() || "bin").toLowerCase();
    const dir = path.join(LOCAL_UPLOAD_DIR, "receipts", String(userId));
    await fs.promises.mkdir(dir, { recursive: true });
    const key = path.join("receipts", String(userId), `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
    const absPath = path.join(LOCAL_UPLOAD_DIR, key);
    await fs.promises.writeFile(absPath, buffer);
    return { key };
}
