import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { ALL_PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function requireFullAdmin(req: NextRequest) {
  const user = await getCurrentUser(req);
  return user?.role === "admin" ? user : null;
}

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  permissions: z.array(z.string()).optional(),
  twoFactorEnabled: z.boolean().optional(),
  isBlocked: z.boolean().optional(),
  password: z.string().min(8, "Use at least 8 characters").optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireFullAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const staff = await User.findById(params.id);
    if (!staff) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    // An admin's own permission set is not editable — admins hold everything by
    // definition, and allowing an edit here would let the last admin lock
    // themselves out of the panel.
    if (staff.role === "admin" && parsed.data.permissions) {
      return NextResponse.json(
        { error: "Administrator accounts always hold every permission" },
        { status: 400 }
      );
    }
    if (staff.role === "admin" && parsed.data.isBlocked && String(staff._id) === admin.id) {
      return NextResponse.json({ error: "You cannot block your own account" }, { status: 400 });
    }

    const before = { permissions: staff.permissions, isBlocked: staff.isBlocked };

    if (parsed.data.name) staff.name = parsed.data.name;
    if (parsed.data.permissions) {
      staff.permissions = parsed.data.permissions.filter((p) =>
        (ALL_PERMISSIONS as string[]).includes(p)
      );
    }
    if (parsed.data.twoFactorEnabled !== undefined) {
      staff.twoFactorEnabled = parsed.data.twoFactorEnabled;
    }
    if (parsed.data.isBlocked !== undefined) staff.isBlocked = parsed.data.isBlocked;
    if (parsed.data.password) staff.password = await bcrypt.hash(parsed.data.password, 12);

    await staff.save();

    await logAdminAction({
      adminId: admin.id,
      action: "STAFF_UPDATE",
      targetType: "User",
      targetId: params.id,
      changes: { before, after: { permissions: staff.permissions, isBlocked: staff.isBlocked } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update staff error:", err);
    return NextResponse.json({ error: "Could not update the account" }, { status: 500 });
  }
}

/**
 * Removes a staff account.
 *
 * Refuses to delete the last remaining admin — a store with no admin cannot
 * grant anyone access again without direct database surgery.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireFullAdmin(req);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const staff = await User.findById(params.id);
    if (!staff) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    if (String(staff._id) === admin.id) {
      return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
    }

    if (staff.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "This is the only administrator account — create another first" },
          { status: 400 }
        );
      }
    }

    // Demoted rather than deleted: the account is referenced by audit-log rows
    // and order notes, and deleting it would leave those pointing at nothing.
    staff.role = "customer";
    staff.permissions = [];
    staff.isBlocked = true;
    await staff.save();

    await logAdminAction({
      adminId: admin.id,
      action: "STAFF_DELETE",
      targetType: "User",
      targetId: params.id,
      changes: { before: { role: "staff" }, after: { role: "customer", isBlocked: true } },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete staff error:", err);
    return NextResponse.json({ error: "Could not remove the account" }, { status: 500 });
  }
}
