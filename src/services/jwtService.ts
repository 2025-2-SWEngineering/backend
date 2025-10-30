import jwt, { SignOptions, Secret, JwtPayload as JwtStdPayload } from "jsonwebtoken";

export type JwtPayload = { id: number; email: string; role?: string };

function getSecret(): Secret {
  const secret = process.env.JWT_SECRET || "dev_secret";
  return secret as Secret;
}

function getRefreshSecret(): Secret {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || "dev_refresh_secret";
  return secret as Secret;
}

function getExpiresIn(): string | number {
  return process.env.JWT_EXPIRE ?? "7d";
}

function getRefreshExpiresIn(): string | number {
  return process.env.JWT_REFRESH_EXPIRE ?? "14d";
}

export function signAccessToken(payload: JwtPayload): string {
  const secret = getSecret();
  const expiresIn = getExpiresIn();
  // Issuer/Audience가 필요하면 환경변수로 확장 가능
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function verifyAccessToken<T extends JwtStdPayload = JwtPayload>(token: string): T {
  const secret = getSecret();
  const decoded = jwt.verify(token, secret);
  return decoded as T;
}

export function signRefreshToken(payload: JwtPayload): string {
  const secret = getRefreshSecret();
  const expiresIn = getRefreshExpiresIn();
  return jwt.sign(payload, secret, { expiresIn } as SignOptions);
}

export function verifyRefreshToken<T extends JwtStdPayload = JwtPayload>(token: string): T {
  const secret = getRefreshSecret();
  const decoded = jwt.verify(token, secret);
  return decoded as T;
}


