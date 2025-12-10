import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/jwtService.js";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader && authHeader.split(" ")[1];

  // Temporary debug logging for auth failures (remove after diagnosis)
  try {
    // mask token for logs (show first 6 and last 4 chars)
    const masked = token
      ? `${token.slice(0, 6)}...${token.slice(-4)}`
      : "(no-token)";
    // eslint-disable-next-line no-console
    console.debug(
      `[AUTH] ${new Date().toISOString()} ${req.method} ${
        req.originalUrl
      } Authorization=${masked}`
    );
  } catch (e) {
    // ignore logging errors
  }

  if (!token) {
    return res.status(401).json({ message: "인증 토큰이 필요합니다." });
  }

  try {
    const decoded = verifyAccessToken<{
      id: number;
      email?: string;
      role?: string;
    }>(token);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      "[AUTH] token verify failed:",
      err instanceof Error ? err.message : err
    );
    return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};
