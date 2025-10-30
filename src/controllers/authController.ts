import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "../models/userModel.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../services/jwtService.js";

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password, name } = req.body as { email?: string; password?: string; name?: string };
    if (!email || !password || !name) {
      return res.status(400).json({ message: "email, password, name은 필수입니다." });
    }
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "이미 등록된 이메일입니다." });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ email, passwordHash, name });
    const payload = { id: user.id, email: user.email, role: user.role };
    const token = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    return res.status(201).json({ token, refreshToken, user });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ message: "email, password는 필수입니다." });
    }
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }
    const isOk = await bcrypt.compare(password, user.password_hash);
    if (!isOk) {
      return res.status(401).json({ message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    }
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
    };
    const payload = { id: user.id, email: user.email, role: user.role };
    const token = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    return res.json({ token, refreshToken, user: safeUser });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      return res.status(400).json({ message: "refreshToken이 필요합니다." });
    }
    const decoded = verifyRefreshToken<{ id: number; email: string; role?: string }>(refreshToken);
    const payload = { id: decoded.id, email: decoded.email, role: decoded.role };
    const token = signAccessToken(payload);
    const nextRefreshToken = signRefreshToken(payload);
    return res.json({ token, refreshToken: nextRefreshToken });
  } catch (err) {
    return res.status(401).json({ message: "리프레시 토큰이 유효하지 않습니다." });
  }
}


