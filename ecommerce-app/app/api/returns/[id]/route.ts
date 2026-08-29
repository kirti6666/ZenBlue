import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Order, ReturnRequest } from "@/models";
import { getCurrentUser } from "@/lib/middleware/requireAuth";
import { requireAdmin } from "@/lib/middleware/requireAdmin";
import { PERMISSIONS } from "@/lib/permissions";
import { logAdminAction, getClientIp } from "@/lib/middleware/logAdminAction";
import { getSiteSettings } from "@/lib/site-settings";
import { absoluteUrl } from "@/lib/seo";
import { notify } from "@/lib/notifications/dispatch";
import { adjustStock } from "@/lib/inventory";
import { creditWallet } from "@/lib/wallet";
import { issueCreditNote } from "@/lib/invoice/creditNote";
import { canTransition, customerCanCancel, pushTimeline, syncOrderReturnedQuantities } from "@/lib/returns";
import {
  ensureReplacementOrder,
  ReplacementOrderError,
} from "@/lib/replacementOrders";

/** Read one request. Customers may read only their own. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    await connectDB();
    const isStaff = user.role === "admin" || user.role === "staff";
    const filter = isStaff ? { _id: params.id } : { _id: params.id, user: user.id };

    const request = await ReturnRequest.findOne(filter)
      .populate("order", "orderNumber total paymentMethod paymentStatus createdAt shippingAddress")
      .populate("replacementOrder", "orderNumber orderStatus paymentStatus total createdAt")
      .populate("user", "name email phone")
      .lean();

    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ request });
  } catch (err) {
    console.error("Get return error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

const adminUpdateSchema = z.object({
  status: z.string().optional(),
  rejectionReason: z.string().max(500).optional(),
  adminNotes: z.string().max(2000).optional(),
  resolution: z.enum(["pending", "refund_source", "store_credit", "replacement", "rejected"]).optional(),
  refundAmount: z.number().min(0).optional(),
  refundReference: z.string().max(200).optional(),
  reversePickup: z
    .object({
      courier: z.string().max(120).optional(),
      awb: z.string().max(120).optional(),
      trackingUrl: z.string().max(500).optional(),
      scheduledFor: z.string().optional(),
    })
    .optional(),
  /** Per-line quality-check results, applied on receipt. */
  qc: z
    .array(
      z.object({
        index: z.number().int().min(0),
        result: z.enum(["passed", "failed"]),
        remarks: z.string().max(500).optional(),
        images: z.array(z.string().url()).max(4).optional(),
        disposition: z.enum(["sellable", "quarantined", "written_off"]).optional(),
      })
    )
    .optional(),
});

/**
 * Admin workflow endpoint — drives a request through its lifecycle.
 *
 * Status changes are validated against the transition table in lib/returns.ts,
 * so a request cannot be refunded twice, approved after rejection, or skipped
 * past quality check. Side effects are attached to specific transitions:
 *
 *   → qc_passed / qc_failed : inventory is adjusted per line disposition
 *   → refund_initiated      : store credit issued (if that is the resolution)
 *   → completed             : credit note issued against the original invoice
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req, PERMISSIONS.RETURNS);
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const parsed = adminUpdateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    await connectDB();
    const settings = await getSiteSettings();

    const request = await ReturnRequest.findById(params.id);
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const order = await Order.findById(request.order);
    if (!order) return NextResponse.json({ error: "Linked order is missing" }, { status: 404 });

    const previousStatus = request.status;
    let createdReplacement: any = null;
    const data = parsed.data;

    // ---- Field updates that are not status transitions ------------------
    if (data.adminNotes !== undefined) request.adminNotes = data.adminNotes;
    if (data.resolution) request.resolution = data.resolution;
    if (data.refundAmount !== undefined) request.refundAmount = data.refundAmount;
    if (data.refundReference) request.refundReference = data.refundReference;
    if (data.reversePickup) {
      request.reversePickup = {
        ...(request.reversePickup ?? {}),
        ...data.reversePickup,
        scheduledFor: data.reversePickup.scheduledFor
          ? new Date(data.reversePickup.scheduledFor)
          : request.reversePickup?.scheduledFor,
      };
    }

    // ---- Quality check results ------------------------------------------
    if (data.qc?.length) {
      for (const entry of data.qc) {
        const line = request.items[entry.index];
        if (!line) continue;
        line.qcResult = entry.result;
        line.qcRemarks = entry.remarks ?? "";
        if (entry.images) line.qcImages = entry.images;
        // A passed item goes back on sale unless the admin says otherwise.
        line.disposition =
          entry.disposition ?? (entry.result === "passed" ? "sellable" : "quarantined");
      }
    }

    // ---- Status transition ----------------------------------------------
    if (data.status && data.status !== previousStatus) {
      if (!canTransition(previousStatus, data.status)) {
        return NextResponse.json(
          { error: `Cannot move a request from "${previousStatus}" to "${data.status}"` },
          { status: 400 }
        );
      }

      if (data.status === "rejected") {
        if (!data.rejectionReason?.trim()) {
          return NextResponse.json(
            { error: "A reason is required when rejecting a request" },
            { status: 400 }
          );
        }
        request.rejectionReason = data.rejectionReason;
        request.resolution = "rejected";
        request.refundStatus = "not_applicable";
      }

      if (data.status === "refund_initiated" && request.resolution === "replacement") {
        return NextResponse.json(
          { error: "A replacement is completed by generating its linked order, not by initiating a refund" },
          { status: 400 }
        );
      }

      let transitionNote = data.rejectionReason ?? "";
      if (data.status === "completed" && request.resolution === "replacement") {
        const replacement = await ensureReplacementOrder({
          request,
          originalOrder: order,
          performedBy: admin.id,
        });
        request.replacementOrder = replacement.order._id;
        request.refundStatus = "not_applicable";
        transitionNote = `Replacement order ${replacement.order.orderNumber} generated and stock reserved`;
        if (replacement.created) createdReplacement = replacement.order;
      }

      request.status = data.status;
      pushTimeline(request, data.status, transitionNote, admin.id);

      // Restock decisions are made once, at quality check.
      if (data.status === "qc_passed" || data.status === "qc_failed") {
        for (const line of request.items) {
          if (line.disposition !== "sellable") continue;
          const result = await adjustStock({
            productId: String(line.product),
            variantKey: line.variantKey ?? "",
            delta: line.quantity,
            reason: "return_restock",
            note: `Restocked from ${request.rmaNumber}`,
            orderId: String(order._id),
            returnRequestId: String(request._id),
            performedBy: admin.id,
          });
          if (!result.ok) console.error("[returns] restock failed:", result.error);
        }
      }

      // Store credit is issued the moment the refund is initiated — it is
      // instant by nature, unlike a gateway refund which has to settle.
      if (data.status === "refund_initiated" && request.resolution === "store_credit") {
        const bonus = settings.returns.storeCreditBonusPercent || 0;
        const amount =
          Math.round((request.refundAmount * (1 + bonus / 100) + Number.EPSILON) * 100) / 100;
        await creditWallet({
          userId: String(request.user),
          amount,
          reason: "return_refund",
          note: `Store credit for ${request.rmaNumber}`,
          orderId: String(order._id),
          returnRequestId: String(request._id),
          performedBy: admin.id,
        });
        request.refundStatus = "processed";
        request.refundedAt = new Date();
      } else if (data.status === "refund_initiated") {
        request.refundStatus = "initiated";
      }

      if (data.status === "refund_processed") {
        request.refundStatus = "completed";
        request.refundedAt = new Date();
        order.refundedAmount = (order.refundedAmount ?? 0) + request.refundAmount;
        order.paymentStatus =
          order.refundedAmount >= order.total ? "refunded" : "partially_refunded";
        await order.save();
      }

      // A completed return is a value reversal, so GST requires a credit note
      // against the original invoice.
      if (data.status === "completed" && !request.creditNote && request.refundAmount > 0) {
        try {
          const note = await issueCreditNote({
            orderId: String(order._id),
            returnRequestId: String(request._id),
            amount: request.refundAmount,
            reason: `Return ${request.rmaNumber}`,
          });
          if (note) request.creditNote = note._id;
        } catch (err) {
          // A credit-note failure must not block closing the return; the admin
          // can re-issue it from the invoicing screen.
          console.error("[returns] credit note failed:", err);
        }
      }
    }

    await request.save();
    await syncOrderReturnedQuantities(String(order._id));

    await logAdminAction({
      adminId: admin.id,
      action: "RETURN_UPDATE",
      targetType: "ReturnRequest",
      targetId: String(request._id),
      changes: { before: { status: previousStatus }, after: { status: request.status } },
      ipAddress: getClientIp(req),
    });

    // ---- Customer notifications -----------------------------------------
    const customer = await (await import("@/models")).User.findById(request.user)
      .select("name email phone")
      .lean<{ name: string; email: string; phone?: string }>();

    if (customer && data.status && data.status !== previousStatus) {
      const base = {
        recipient: { email: customer.email, phone: customer.phone, userId: String(request.user) },
        orderId: String(order._id),
        settings,
        context: {
          customerName: customer.name,
          orderNumber: order.orderNumber,
          orderUrl: absoluteUrl(`/account/returns/${request._id}`),
          total: order.total,
          amount: request.refundAmount,
          reason: request.rejectionReason,
          awb: request.reversePickup?.awb,
          courierName: request.reversePickup?.courier,
        },
      };

      if (data.status === "approved") await notify({ event: "return_approved", ...base });
      else if (data.status === "rejected") await notify({ event: "return_rejected", ...base });
      else if (data.status === "refund_initiated" || data.status === "refund_processed") {
        await notify({
          event: request.resolution === "store_credit" ? "store_credit_issued" : "refund_issued",
          ...base,
        });
      }

      if (createdReplacement) {
        await notify({
          event: "order_confirmed",
          recipient: { email: customer.email, phone: customer.phone, userId: String(request.user) },
          orderId: String(createdReplacement._id),
          settings,
          context: {
            customerName: customer.name,
            orderNumber: createdReplacement.orderNumber,
            orderUrl: absoluteUrl(`/account/orders/${createdReplacement._id}`),
            total: 0,
          },
        });
      }
    }

    return NextResponse.json({ request: request.toObject() });
  } catch (err) {
    console.error("Update return error:", err);
    if (err instanceof ReplacementOrderError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Could not update the request" }, { status: 500 });
  }
}

/**
 * Customer cancels their own request.
 *
 * Only allowed while the parcel has not yet been collected — once it is with
 * the courier, cancelling would leave the warehouse expecting nothing while a
 * box is in transit.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!user) return NextResponse.json({ error: "Please log in" }, { status: 401 });

    await connectDB();
    const request = await ReturnRequest.findOne({ _id: params.id, user: user.id });
    if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!customerCanCancel(request.status)) {
      return NextResponse.json(
        { error: "This request can no longer be cancelled — please contact support" },
        { status: 400 }
      );
    }

    request.status = "cancelled";
    pushTimeline(request, "cancelled", "Cancelled by customer", user.id);
    await request.save();
    await syncOrderReturnedQuantities(String(request.order));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Cancel return error:", err);
    return NextResponse.json({ error: "Could not cancel the request" }, { status: 500 });
  }
}
