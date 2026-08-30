import { SignJWT, jwtVerify } from "jose";

/**
 * Secrets are read when a token is signed or verified, not at module load.
 *
 * Throwing at import time made this module — and therefore every route that
 * touches auth — unloadable without secrets configured, which broke `next
 * build` and any script that merely imported something downstream of it. The
 * failure then pointed at this file rather than at the missing configuration.
 * Same reasoning as lib/db.ts and lib/razorpay.ts.
 */
function secret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      [
        `${name} is not set.`,
        "",
        "Add both of these to `.env.local` in the project root, as two DIFFERENT",
        "long random strings:",
        "",
        "  JWT_ACCESS_SECRET=<random>",
        "  JWT_REFRESH_SECRET=<random>",
        "",
        "Generate each with:",
        `  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
      ].join("\n")
    );
  }

  return new TextEncoder().encode(value);
}

const ACCESS_TOKEN_EXPIRY = "30d";
const REFRESH_TOKEN_EXPIRY = "180d";

export interface JWTPayload {
  userId: string;
  email: string;
  role: "customer" | "staff" | "admin";
  /** Mirrored into the token so admin route guards need no extra DB read. */
  permissions?: string[];
}

export async function signAccessToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(secret("JWT_ACCESS_SECRET"));
}

export async function signRefreshToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(secret("JWT_REFRESH_SECRET"));
}

export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret("JWT_ACCESS_SECRET"));
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret("JWT_REFRESH_SECRET"));
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

export const accessCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days, matches ACCESS_TOKEN_EXPIRY
};

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 180, // six months, matches REFRESH_TOKEN_EXPIRY
};
