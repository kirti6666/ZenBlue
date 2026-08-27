import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Order, User } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * Customer list with lifetime value.
 *
 * Order totals are aggregated in the database rather than fetched and summed in
 * Node: a store with 5,000 customers would otherwise pull every order into
 * memory to render one page. The $lookup runs once and returns only the
 * per-customer rollup.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.CUSTOMERS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") ?? "").trim();
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));

    const match: Record<string, unknown> = { role: "customer" };
    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      match.$or = [
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } },
      ];
    }

    const [customers, total] = await Promise.all([
      User.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $lookup: {
            from: "orders",
            localField: "_id",
            foreignField: "user",
            as: "orders",
            // Cancelled orders are excluded from lifetime value — counting them
            // would overstate every customer's worth.
            pipeline: [
              { $match: { orderStatus: { $ne: "cancelled" } } },
              { $project: { total: 1, createdAt: 1 } },
            ],
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            phone: 1,
            createdAt: 1,
            isBlocked: 1,
            marketingOptIn: 1,
            provider: 1,
            orderCount: { $size: "$orders" },
            lifetimeValue: { $sum: "$orders.total" },
            lastOrderAt: { $max: "$orders.createdAt" },
          },
        },
      ]),
      User.countDocuments(match),
    ]);

    return NextResponse.json({
      customers,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("Customer list error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
