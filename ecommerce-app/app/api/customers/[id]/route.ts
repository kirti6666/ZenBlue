import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Address, Order, ReturnRequest, User } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { getWalletBalance } from "@/lib/wallet";

export const dynamic = "force-dynamic";

/** One customer with their orders, returns, addresses and credit balance. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CUSTOMERS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const [customer, orders, returns, addresses, walletBalance] = await Promise.all([
      User.findById(params.id).select("-password").lean(),
      Order.find({ user: params.id }).sort({ createdAt: -1 }).limit(100).lean(),
      ReturnRequest.find({ user: params.id }).sort({ createdAt: -1 }).limit(50).lean(),
      Address.find({ user: params.id }).lean(),
      getWalletBalance(params.id),
    ]);

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    return NextResponse.json({ customer, orders, returns, addresses, walletBalance });
  } catch (err) {
    console.error("Customer read error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

const updateSchema = z.object({
  isBlocked: z.boolean().optional(),
  marketingOptIn: z.boolean().optional(),
  phone: z.string().max(20).optional(),
  name: z.string().min(2).max(120).optional(),
});

/**
 * Admin edit of a customer record.
 *
 * Deliberately narrow: role changes are not accepted here. Promoting someone to
 * staff goes through /api/staff, which enforces that only a full admin can do
 * it — otherwise a staff member with CUSTOMERS permission could grant
 * themselves admin by editing their own record.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.CUSTOMERS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const customer = await User.findById(params.id);
    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    if (customer.role !== "customer") {
      return NextResponse.json(
        { error: "Staff and admin accounts are managed under Staff & permissions" },
        { status: 400 }
      );
    }

    const before = { isBlocked: customer.isBlocked, marketingOptIn: customer.marketingOptIn };
    Object.assign(customer, parsed.data);
    await customer.save();

    await logAdminAction({
      adminId: admin.id,
      action: "CUSTOMER_UPDATE",
      targetType: "User",
      targetId: params.id,
      changes: { before, after: parsed.data },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Customer update error:", err);
    return NextResponse.json({ error: "Could not update the customer" }, { status: 500 });
  }
}
