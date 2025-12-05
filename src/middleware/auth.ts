import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/jwtService.js";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader && authHeader.split(" ")[1];

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
  } catch {
    // 개발용 디버그 로그: 토큰이 존재하지만 검증에 실패할 때 원인을 확인하기 위해 에러 정보를 출력합니다.
    // 주의: 프로덕션에서는 민감 정보를 로그에 남기지 마십시오.
    try {
      // 일부 에러 메시지를 더 자세히 남기기 위해 재검증 시도하여 에러 출력
      verifyAccessToken(token as string);
    } catch (err) {
      // err는 Error 타입일 가능성이 높음
      // 토큰 앞부분(예: 첫 12문자)만 남겨 원본 토큰 전체를 로그에 남기지 않음
      const preview =
        typeof token === "string" ? `${token.slice(0, 12)}...` : null;
      // eslint-disable-next-line no-console
      console.error("[auth] access token verification failed", {
        preview,
        error: (err as Error).message,
      });
    }
    return res.status(403).json({ message: "유효하지 않은 토큰입니다." });
  }
};
