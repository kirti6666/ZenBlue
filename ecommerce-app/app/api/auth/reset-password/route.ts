import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { PasswordResetToken, User } from "@/models";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const parsed = resetPasswordSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
    const resetToken = await PasswordResetToken.findOneAndDelete({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });
    if (!resetToken) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Request a new one." },
        { status: 400 }
      );
    }

    const password = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.findOneAndUpdate(
      { _id: resetToken.user, isBlocked: { $ne: true } },
      { $set: { password, provider: "credentials" } },
      { new: true }
    ).select("_id");
    if (!user) {
      return NextResponse.json({ error: "This account cannot be updated" }, { status: 400 });
    }

    await PasswordResetToken.deleteMany({ user: resetToken.user });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Could not reset the password right now" }, { status: 500 });
  }
}

