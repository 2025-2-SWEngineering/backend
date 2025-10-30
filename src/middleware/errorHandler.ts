import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = (err as { status?: number }).status || 500;
  const message = (err as { message?: string }).message || "서버 오류가 발생했습니다.";
  const stack = (err as { stack?: string }).stack;
  console.error(stack || err);
  res.status(status).json({
    message,
    ...(process.env.NODE_ENV === "development" && { stack }),
  });
};
