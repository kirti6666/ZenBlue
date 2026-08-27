import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Order, Product, ReturnRequest, Subscriber, User } from "@/models";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { toCsv, csvResponse, type CsvValue } from "@/lib/csv";
import { variantLabel, totalStock } from "@/lib/inventory";

export const dynamic = "force-dynamic";

/**
 * CSV exports for the admin's Reports screen.
 *
 * One endpoint with a `type` parameter rather than five near-identical routes —
 * they share the permission check, the date-range parsing and the response
 * wrapper, and only differ in the query and the column map.
 *
 * Every export is capped. An unbounded export on a large store is the fastest
 * way to run a serverless function out of memory, and no one opens a
 * 200,000-row spreadsheet anyway.
 */
const MAX_ROWS = 10000;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req, PERMISSIONS.REPORTS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "orders";

    const from = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
    const to = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;
    // The "to" date is inclusive of the whole day the user picked.
    if (to) to.setHours(23, 59, 59, 999);

    const dateFilter =
      from || to
        ? { createdAt: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } }
        : {};

    switch (type) {
      case "orders":
        return exportOrders(dateFilter);
      case "order-items":
        return exportOrderItems(dateFilter);
      case "products":
        return exportProducts();
      case "customers":
        return exportCustomers(dateFilter);
      case "returns":
        return exportReturns(dateFilter);
      case "subscribers":
        return exportSubscribers();
      default:
        return NextResponse.json({ error: `Unknown export type "${type}"` }, { status: 400 });
    }
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Could not generate the export" }, { status: 500 });
  }
}

async function exportOrders(dateFilter: Record<string, unknown>) {
  const orders = await Order.find(dateFilter)
    .populate("user", "name email phone")
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .lean();

  const rows: Record<string, CsvValue>[] = (orders as any[]).map((o) => ({
    orderNumber: o.orderNumber,
    placedAt: new Date(o.createdAt).toLocaleString("en-IN"),
    customer: o.user?.name ?? o.shippingAddress?.fullName ?? "Guest",
    email: o.user?.email ?? o.guestEmail ?? "",
    phone: o.shippingAddress?.phone ?? "",
    items: o.items.reduce((s: number, i: any) => s + i.quantity, 0),
    subtotal: o.subtotal,
    discount: o.discount,
    coupon: o.couponCode ?? "",
    storeCredit: o.walletUsed ?? 0,
    shipping: o.shippingFee,
    tax: o.taxAmount ?? 0,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    orderStatus: o.orderStatus,
    awb: o.awb ?? "",
    courier: o.courierName ?? "",
    city: o.shippingAddress?.city ?? "",
    state: o.shippingAddress?.state ?? "",
    pincode: o.shippingAddress?.pincode ?? "",
  }));

  return csvResponse(
    toCsv(rows, [
      { key: "orderNumber", label: "Order" },
      { key: "placedAt", label: "Placed at" },
      { key: "customer", label: "Customer" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "items", label: "Units" },
      { key: "subtotal", label: "Subtotal" },
      { key: "discount", label: "Discount" },
      { key: "coupon", label: "Coupon" },
      { key: "storeCredit", label: "Store credit" },
      { key: "shipping", label: "Shipping" },
      { key: "tax", label: "Tax" },
      { key: "total", label: "Total" },
      { key: "paymentMethod", label: "Payment method" },
      { key: "paymentStatus", label: "Payment status" },
      { key: "orderStatus", label: "Order status" },
      { key: "awb", label: "AWB" },
      { key: "courier", label: "Courier" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "pincode", label: "Pincode" },
    ]),
    "zenblue-orders"
  );
}

/**
 * One row per line item rather than per order — this is the shape you need to
 * answer "which size of which product actually sells", which an order-level
 * export cannot tell you.
 */
async function exportOrderItems(dateFilter: Record<string, unknown>) {
  const orders = await Order.find(dateFilter).sort({ createdAt: -1 }).limit(MAX_ROWS).lean();

  const rows: Record<string, CsvValue>[] = [];
  for (const o of orders as any[]) {
    for (const item of o.items) {
      rows.push({
        orderNumber: o.orderNumber,
        placedAt: new Date(o.createdAt).toLocaleDateString("en-IN"),
        product: item.title,
        sku: item.sku ?? "",
        variant: variantLabel(item.variant),
        hsn: item.hsnCode ?? "",
        quantity: item.quantity,
        unitPrice: item.price,
        lineTotal: item.price * item.quantity,
        returned: item.returnedQuantity ?? 0,
        orderStatus: o.orderStatus,
      });
    }
  }

  return csvResponse(
    toCsv(rows, [
      { key: "orderNumber", label: "Order" },
      { key: "placedAt", label: "Date" },
      { key: "product", label: "Product" },
      { key: "sku", label: "SKU" },
      { key: "variant", label: "Variant" },
      { key: "hsn", label: "HSN" },
      { key: "quantity", label: "Qty" },
      { key: "unitPrice", label: "Unit price" },
      { key: "lineTotal", label: "Line total" },
      { key: "returned", label: "Returned qty" },
      { key: "orderStatus", label: "Order status" },
    ]),
    "zenblue-order-items"
  );
}

async function exportProducts() {
  const products = await Product.find({})
    .populate("category", "name")
    .sort({ title: 1 })
    .limit(MAX_ROWS)
    .lean();

  const rows: Record<string, CsvValue>[] = (products as any[]).map((p) => ({
    title: p.title,
    slug: p.slug,
    sku: p.sku ?? "",
    category: p.category?.name ?? "",
    price: p.price,
    discountPrice: p.discountPrice ?? "",
    stock: totalStock(p),
    variants: p.variantCombinations?.length ?? 0,
    hsn: p.hsnCode ?? "",
    gstRate: p.gstRate ?? "",
    fabric: p.fabric ?? "",
    weightKg: p.weightKg ?? "",
    salesCount: p.salesCount ?? 0,
    rating: p.ratingsAverage ?? 0,
    reviews: p.ratingsCount ?? 0,
    active: p.isActive,
    featured: p.isFeatured,
  }));

  return csvResponse(
    toCsv(rows, [
      { key: "title", label: "Product" },
      { key: "slug", label: "Slug" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Category" },
      { key: "price", label: "Price" },
      { key: "discountPrice", label: "Sale price" },
      { key: "stock", label: "Stock" },
      { key: "variants", label: "Variants" },
      { key: "hsn", label: "HSN" },
      { key: "gstRate", label: "GST %" },
      { key: "fabric", label: "Fabric" },
      { key: "weightKg", label: "Weight (kg)" },
      { key: "salesCount", label: "Units sold" },
      { key: "rating", label: "Rating" },
      { key: "reviews", label: "Reviews" },
      { key: "active", label: "Active" },
      { key: "featured", label: "Featured" },
    ]),
    "zenblue-products"
  );
}

async function exportCustomers(dateFilter: Record<string, unknown>) {
  const customers = await User.aggregate([
    { $match: { role: "customer", ...dateFilter } },
    { $sort: { createdAt: -1 } },
    { $limit: MAX_ROWS },
    {
      $lookup: {
        from: "orders",
        localField: "_id",
        foreignField: "user",
        as: "orders",
        pipeline: [
          { $match: { orderStatus: { $ne: "cancelled" } } },
          { $project: { total: 1, createdAt: 1 } },
        ],
      },
    },
  ]);

  const rows: Record<string, CsvValue>[] = customers.map((c: any) => ({
    name: c.name,
    email: c.email,
    phone: c.phone ?? "",
    joined: new Date(c.createdAt).toLocaleDateString("en-IN"),
    orders: c.orders.length,
    lifetimeValue: c.orders.reduce((s: number, o: any) => s + o.total, 0),
    lastOrder: c.orders.length
      ? new Date(Math.max(...c.orders.map((o: any) => new Date(o.createdAt).getTime()))).toLocaleDateString("en-IN")
      : "",
    marketingOptIn: !!c.marketingOptIn,
    blocked: !!c.isBlocked,
  }));

  return csvResponse(
    toCsv(rows, [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "joined", label: "Joined" },
      { key: "orders", label: "Orders" },
      { key: "lifetimeValue", label: "Lifetime value" },
      { key: "lastOrder", label: "Last order" },
      { key: "marketingOptIn", label: "Marketing opt-in" },
      { key: "blocked", label: "Blocked" },
    ]),
    "zenblue-customers"
  );
}

async function exportReturns(dateFilter: Record<string, unknown>) {
  const returns = await ReturnRequest.find(dateFilter)
    .populate("order", "orderNumber")
    .populate("user", "name email")
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .lean();

  const rows: Record<string, CsvValue>[] = (returns as any[]).map((r) => ({
    rma: r.rmaNumber,
    raised: new Date(r.createdAt).toLocaleDateString("en-IN"),
    order: r.order?.orderNumber ?? "",
    customer: r.user?.name ?? "",
    email: r.user?.email ?? "",
    type: r.type,
    reason: r.reason,
    units: r.items.reduce((s: number, i: any) => s + i.quantity, 0),
    refundAmount: r.refundAmount ?? 0,
    resolution: r.resolution,
    refundStatus: r.refundStatus,
    status: r.status,
  }));

  return csvResponse(
    toCsv(rows, [
      { key: "rma", label: "RMA" },
      { key: "raised", label: "Raised" },
      { key: "order", label: "Order" },
      { key: "customer", label: "Customer" },
      { key: "email", label: "Email" },
      { key: "type", label: "Type" },
      { key: "reason", label: "Reason" },
      { key: "units", label: "Units" },
      { key: "refundAmount", label: "Refund" },
      { key: "resolution", label: "Resolution" },
      { key: "refundStatus", label: "Refund status" },
      { key: "status", label: "Status" },
    ]),
    "zenblue-returns"
  );
}

async function exportSubscribers() {
  const subscribers = await Subscriber.find({ status: "subscribed" })
    .sort({ createdAt: -1 })
    .limit(MAX_ROWS)
    .lean();

  const rows: Record<string, CsvValue>[] = (subscribers as any[]).map((s) => ({
    email: s.email,
    name: s.name ?? "",
    source: s.source ?? "",
    subscribed: new Date(s.createdAt).toLocaleDateString("en-IN"),
  }));

  return csvResponse(
    toCsv(rows, [
      { key: "email", label: "Email" },
      { key: "name", label: "Name" },
      { key: "source", label: "Source" },
      { key: "subscribed", label: "Subscribed" },
    ]),
    "zenblue-subscribers"
  );
}
