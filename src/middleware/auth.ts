import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/jwtService.js";

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "인증 토큰이 필요합니다." });
  }

  try {
    const decoded = verifyAccessToken<{ id: number; email?: string; role?: string }>(token);
    req.user = { id: decoded.id, email: decoded.email };
    next();
  } catch {
    return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};
