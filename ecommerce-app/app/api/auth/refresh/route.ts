import { NextRequest, NextResponse } from "next/server";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token provided" }, { status: 401 });
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired refresh token" }, { status: 401 });
  }

  const { userId, email } = payload;

  // Re-read the role and permissions from the database rather than copying them
  // out of the old token. Two reasons: a staff member's grants would otherwise
  // be frozen at whatever they were when they logged in, and — more
  // importantly — revoking access or blocking an account now takes effect at
  // the next refresh (within 15 minutes) instead of requiring the user to log
  // out voluntarily.
  await connectDB();
  const dbUser = await User.findById(userId).select("role permissions isBlocked").lean<{
    role: "customer" | "staff" | "admin";
    permissions?: string[];
    isBlocked?: boolean;
  }>();

  if (!dbUser || dbUser.isBlocked) {
    const res = NextResponse.json({ error: "Account is no longer active" }, { status: 401 });
    res.cookies.delete(ACCESS_TOKEN_COOKIE);
    res.cookies.delete(REFRESH_TOKEN_COOKIE);
    return res;
  }

  const claims = {
    userId,
    email,
    role: dbUser.role,
    permissions: dbUser.permissions ?? [],
  };

  // Rotate both tokens on refresh (not just the access token) — limits how long
  // a stolen refresh token stays useful.
  const newAccessToken = await signAccessToken(claims);
  const newRefreshToken = await signRefreshToken(claims);

  const res = NextResponse.json({ success: true });
  res.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, accessCookieOptions);
  res.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, refreshCookieOptions);

  return res;
}
