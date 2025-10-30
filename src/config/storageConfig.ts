import path from "path";
import { S3Client } from "@aws-sdk/client-s3";

export const BUCKET = process.env.AWS_S3_BUCKET_NAME as string | undefined;
export const LOCAL_UPLOAD_DIR = process.env.LOCAL_UPLOAD_DIR || path.resolve(process.cwd(), "local_uploads");
export const AWS_REGION = process.env.AWS_REGION || "";

export function resolveStorageMode(): "s3" | "local" {
  const envMode = (process.env.FILE_STORAGE_MODE || "").toLowerCase();
  if (envMode === "s3") return "s3";
  if (envMode === "local") return "local";
  return BUCKET ? "s3" : "local"; // auto-detect
}

export const STORAGE_MODE = resolveStorageMode();

export const s3 = new S3Client({ region: AWS_REGION || undefined });

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/x-pdf",
  "application/acrobat",
] as const;

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "pdf"] as const;
