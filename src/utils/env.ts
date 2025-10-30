export function validateEnv(): void {
  const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD", "JWT_SECRET"] as const;
  const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === "");
  if (missing.length) {
    throw new Error(`환경 변수 누락: ${missing.join(", ")}`);
  }
}

export function awsConfigStatus(): { enabled: boolean; region?: string; bucket?: string } {
  const ok = !!(process.env.AWS_REGION && process.env.AWS_S3_BUCKET_NAME);
  return { enabled: ok, region: process.env.AWS_REGION, bucket: process.env.AWS_S3_BUCKET_NAME };
}
