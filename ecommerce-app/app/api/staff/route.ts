import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { ALL_PERMISSIONS, DEFAULT_STAFF_PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Staff accounts and their permissions.
 *
 * Every handler here requires role === "admin" specifically, NOT the STAFF
 * permission. Granting the ability to manage staff through a permission would
 * let a staff member escalate themselves to full admin, which defeats the point
 * of having a restricted role at all.
 */
async function requireFullAdmin(req: NextRequest) {
  const user = await getCurrentUser(req);
  return user?.role === "admin" ? user : null;
}

export async function GET(req: NextRequest) {
  const admin = await requireFullAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await connectDB();
  const staff = await User.find({ role: { $in: ["staff", "admin"] } })
    .select("name email role permissions twoFactorEnabled isBlocked lastLoginAt createdAt")
    .sort({ createdAt: 1 })
    .lean();

  return NextResponse.json({ staff, allPermissions: ALL_PERMISSIONS });
}

const createSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  permissions: z.array(z.string()).optional(),
  twoFactorEnabled: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  const admin = await requireFullAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const email = parsed.data.email.toLowerCase().trim();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists" },
        { status: 409 }
      );
    }

    // Silently drop anything not in the known permission set, so a crafted
    // request cannot store a string that a future check might match on.
    const permissions = (parsed.data.permissions ?? DEFAULT_STAFF_PERMISSIONS).filter((p) =>
      (ALL_PERMISSIONS as string[]).includes(p)
    );

    const staff = await User.create({
      name: parsed.data.name,
      email,
      password: await bcrypt.hash(parsed.data.password, 12),
      role: "staff",
      permissions,
      isVerified: true,
      // Two-factor defaults ON for back-office accounts — they can read every
      // customer's address and order history.
      twoFactorEnabled: parsed.data.twoFactorEnabled ?? true,
    });

    await logAdminAction({
      adminId: admin.id,
      action: "STAFF_CREATE",
      targetType: "User",
      targetId: String(staff._id),
      changes: { after: { email, permissions } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(
      { staff: { _id: staff._id, name: staff.name, email: staff.email, permissions } },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create staff error:", err);
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }
}
