import jwt from "jsonwebtoken";

export interface JwtPayloadData {
  userId: string;
  isAdmin?: boolean;
  iat?: number;
  exp?: number;
}

export function verifyAccessToken(token: string, secret: string) {
  return jwt.verify(token, secret) as JwtPayloadData;
}

export function signAccessToken(payload: JwtPayloadData, secret: string, expiresIn = "15m") {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signRefreshToken(payload: JwtPayloadData, secret: string, expiresIn = "30d") {
  return jwt.sign(payload, secret, { expiresIn });
}
