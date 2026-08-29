import { Order, Product, ReturnRequest } from "@/models";
import { adjustStock, stockForVariant, variantKey } from "@/lib/inventory";

export class ReplacementOrderError extends Error {}

type ReplacementResult = {
  order: any;
  created: boolean;
};

function asVariant(value: unknown): Record<string, string> {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return { ...(value as Record<string, string>) };
}

/**
 * Creates and reserves stock for one no-charge replacement order.
 *
 * The return request and Order both carry the link, while the unique sparse
 * index on Order.isReplacementFor prevents a double-click from producing two
 * replacement shipments. Any partially reserved stock is released if a later
 * line fails, so inventory and the stock ledger stay consistent.
 */
export async function ensureReplacementOrder({
  request,
  originalOrder,
  performedBy,
}: {
  request: any;
  originalOrder: any;
  performedBy: string;
}): Promise<ReplacementResult> {
  if (request.type !== "exchange") {
    throw new ReplacementOrderError("Replacement is only available for exchange requests");
  }

  if (request.replacementOrder) {
    const existing = await Order.findById(request.replacementOrder);
    if (existing) return { order: existing, created: false };
  }

  const existing = await Order.findOne({ isReplacementFor: request._id });
  if (existing) {
    request.replacementOrder = existing._id;
    await ReturnRequest.updateOne(
      { _id: request._id },
      { $set: { replacementOrder: existing._id } }
    );
    return { order: existing, created: false };
  }

  const productIds = [...new Set(request.items.map((line: any) => String(line.product)))];
  const products = await Product.find({ _id: { $in: productIds } });
  const byId = new Map(products.map((product: any) => [String(product._id), product]));

  const lines = request.items.map((line: any) => {
    const product: any = byId.get(String(line.product));
    if (!product) throw new ReplacementOrderError(`Product "${line.title}" no longer exists`);

    const requestedVariant = asVariant(line.exchangeVariant);
    const originalVariant = asVariant(line.variant);
    const targetVariant = Object.keys(requestedVariant).length ? requestedVariant : originalVariant;
    const targetKey = line.exchangeVariantKey || variantKey(targetVariant);
    const available = stockForVariant(product, targetKey);
    if (available < line.quantity) {
      throw new ReplacementOrderError(
        `Insufficient replacement stock for ${line.title}${targetKey ? ` (${targetKey})` : ""}: ${available} available`
      );
    }

    const combo = product.variantCombinations?.find(
      (entry: any) => variantKey(entry.combination) === targetKey
    );

    return {
      product,
      targetVariant,
      targetKey,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      orderItem: {
        product: product._id,
        title: line.title || product.title,
        price: line.unitPrice,
        quantity: line.quantity,
        image: combo?.image || line.image || product.images?.[0] || "",
        variant: targetVariant,
        hsnCode: product.hsnCode ?? "",
        gstRate: product.gstRate ?? null,
        sku: combo?.sku || product.sku || "",
      },
    };
  });

  const subtotal = lines.reduce(
    (sum: number, line: any) => sum + line.unitPrice * line.quantity,
    0
  );

  let replacement: any;
  try {
    replacement = await Order.create({
      user: originalOrder.user,
      isGuest: false,
      items: lines.map((line: any) => line.orderItem),
      shippingAddress: originalOrder.shippingAddress,
      billingAddress: originalOrder.billingAddress || originalOrder.shippingAddress,
      subtotal,
      discount: subtotal,
      walletUsed: 0,
      shippingFee: 0,
      taxAmount: 0,
      total: 0,
      paymentMethod: originalOrder.paymentMethod,
      paymentStatus: "paid",
      orderStatus: "confirmed",
      refundedAmount: 0,
      internalNotes: `No-charge replacement for ${request.rmaNumber}; original order ${originalOrder.orderNumber}`,
      isReplacementFor: request._id,
      statusHistory: [
        {
          status: "confirmed",
          note: `Replacement generated from ${request.rmaNumber}`,
          at: new Date(),
        },
      ],
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      const winner = await Order.findOne({ isReplacementFor: request._id });
      if (winner) return { order: winner, created: false };
    }
    throw error;
  }

  const reserved: any[] = [];
  try {
    for (const line of lines) {
      const result = await adjustStock({
        productId: String(line.product._id),
        variantKey: line.targetKey,
        delta: -line.quantity,
        reason: "exchange_reserved",
        note: `Reserved for replacement ${replacement.orderNumber} (${request.rmaNumber})`,
        orderId: String(replacement._id),
        returnRequestId: String(request._id),
        performedBy,
      });
      if (!result.ok) throw new ReplacementOrderError(result.error || "Could not reserve stock");
      reserved.push(line);
    }

    const link = await ReturnRequest.updateOne(
      { _id: request._id, replacementOrder: { $exists: false } },
      { $set: { replacementOrder: replacement._id } }
    );
    if (link.matchedCount === 0) {
      throw new ReplacementOrderError("A replacement order has already been linked");
    }
    request.replacementOrder = replacement._id;
    return { order: replacement, created: true };
  } catch (error) {
    for (const line of reserved.reverse()) {
      const rollback = await adjustStock({
        productId: String(line.product._id),
        variantKey: line.targetKey,
        delta: line.quantity,
        reason: "exchange_released",
        note: `Rollback for failed replacement ${replacement.orderNumber}`,
        orderId: String(replacement._id),
        returnRequestId: String(request._id),
        performedBy,
      });
      if (!rollback.ok) console.error("[replacement] stock rollback failed:", rollback.error);
    }
    await Order.deleteOne({ _id: replacement._id });
    throw error;
  }
}
