"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CardListSkeleton } from "@/components/ui/Skeleton";
import { useCurrency } from "@/lib/useCurrency";
import { AdminPageHeader, Card, EmptyState, Pill } from "@/components/admin/AdminPage";

interface OrderItem {
  title: string;
  quantity: number;
  price: number;
  sku?: string;
}

interface Order {
  _id: string;
  orderNumber?: string;
  user: { name: string; email: string } | null;
  isGuest?: boolean;
  guestEmail?: string;
  items: OrderItem[];
  total: number;
  walletUsed?: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  awb?: string;
  courierName?: string;
  internalNotes?: string;
  shippingAddress?: { fullName: string; city: string; state: string; phone: string };
  createdAt: string;
}

const ORDER_STATUSES = [
  "placed",
  "confirmed",
  "processing",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded", "partially_refunded"];

function statusTone(status: string): "default" | "success" | "warning" | "error" | "info" {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "returned") return "error";
  if (status === "shipped" || status === "out_for_delivery") return "info";
  if (status === "placed") return "warning";
  return "default";
}

/**
 * Order management.
 *
 * Cancellation is deliberately NOT available from the status dropdown — it has
 * real side effects (restock, refund, credit note) and needs a confirmation
 * and a reason, so it has its own control.
 */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const { symbol: currency } = useCurrency();

  async function loadOrders() {
    setLoading(true);
    const params = new URLSearchParams({ limit: "100" });
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/orders?${params.toString()}`);
    const data = await res.json();
    setOrders(data.orders ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function update(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError("");
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      await loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingId(null);
      setCancelling(null);
      setCancelReason("");
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Orders"
        description="Update status, add internal notes, and cancel with automatic restock and refund."
        actions={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
            className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-heading"
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        }
      />

      {error && <p className="mb-4 rounded-lg bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {loading ? (
        <CardListSkeleton count={5} />
      ) : orders.length === 0 ? (
        <EmptyState message="No orders match this filter." />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isOpen = expanded === order._id;
            const busy = savingId === order._id;
            const canCancel = !["cancelled", "delivered", "returned"].includes(order.orderStatus);

            return (
              <Card key={order._id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-heading">
                      {order.orderNumber ?? `#${order._id.slice(-8)}`}
                      {order.isGuest && (
                        <span className="ml-2">
                          <Pill>Guest</Pill>
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-body">
                      {order.user?.name ?? order.shippingAddress?.fullName ?? "Unknown"}
                    </p>
                    <p className="text-xs text-muted">
                      {order.user?.email ?? order.guestEmail ?? "—"}
                      {order.shippingAddress &&
                        ` · ${order.shippingAddress.city}, ${order.shippingAddress.state}`}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {new Date(order.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold text-heading">
                      {currency}
                      {order.total}
                    </p>
                    {(order.walletUsed ?? 0) > 0 && (
                      <p className="text-xs text-success">
                        +{currency}
                        {order.walletUsed} store credit
                      </p>
                    )}
                    <p className="text-xs text-muted">
                      {order.paymentMethod === "razorpay" ? "Prepaid" : "COD"} ·{" "}
                      {order.paymentStatus}
                    </p>
                    <a
                      href={`/api/invoices/${order._id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs text-link underline underline-offset-4"
                    >
                      Invoice
                    </a>
                  </div>
                </div>

                <p className="mt-2 text-sm text-muted">
                  {order.items.map((item, i) => (
                    <span key={i}>
                      {item.title} × {item.quantity}
                      {i < order.items.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>

                {order.awb && (
                  <p className="mt-1 text-xs text-muted">
                    {order.courierName} · AWB {order.awb}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <Pill tone={statusTone(order.orderStatus)}>
                    {order.orderStatus.replace(/_/g, " ")}
                  </Pill>

                  <select
                    value={order.orderStatus}
                    disabled={busy || order.orderStatus === "cancelled"}
                    onChange={(e) => update(order._id, { orderStatus: e.target.value })}
                    aria-label="Order status"
                    className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-heading disabled:opacity-50"
                  >
                    {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>

                  <select
                    value={order.paymentStatus}
                    disabled={busy}
                    onChange={(e) => update(order._id, { paymentStatus: e.target.value })}
                    aria-label="Payment status"
                    className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-heading"
                  >
                    {PAYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        payment: {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(isOpen ? null : order._id);
                      setNoteDraft(order.internalNotes ?? "");
                    }}
                    className="text-xs text-link underline underline-offset-4"
                  >
                    {isOpen ? "Hide notes" : order.internalNotes ? "View notes" : "Add note"}
                  </button>

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => setCancelling(cancelling === order._id ? null : order._id)}
                      className="text-xs text-error underline underline-offset-4"
                    >
                      Cancel order
                    </button>
                  )}

                  <Link
                    href="/admin/shipping"
                    className="ml-auto text-xs text-link underline underline-offset-4"
                  >
                    Shipping desk →
                  </Link>
                </div>

                {isOpen && (
                  <div className="mt-3 border-t border-line pt-3">
                    <label className="block text-xs text-muted">
                      Internal notes — never shown to the customer
                    </label>
                    <textarea
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => update(order._id, { internalNotes: noteDraft })}
                      className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                    >
                      Save note
                    </button>
                  </div>
                )}

                {cancelling === order._id && (
                  <div className="mt-3 rounded-lg border border-error/40 p-3">
                    <p className="text-sm font-medium text-heading">
                      Cancel {order.orderNumber ?? "this order"}?
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Stock returns to the shelf, any store credit spent is given back, and a paid
                      order is refunded with a GST credit note issued against its invoice.
                    </p>
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      placeholder="Reason (shown to the customer)"
                      className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-heading"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          update(order._id, {
                            orderStatus: "cancelled",
                            cancellationReason: cancelReason,
                            restock: true,
                          })
                        }
                        className="rounded-lg bg-error px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {busy ? "Cancelling…" : "Cancel & refund to source"}
                      </button>
                      {order.paymentStatus === "paid" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            update(order._id, {
                              orderStatus: "cancelled",
                              cancellationReason: cancelReason,
                              restock: true,
                              refundAsStoreCredit: true,
                            })
                          }
                          className="rounded-lg border border-line px-4 py-2 text-sm text-heading"
                        >
                          Cancel &amp; issue store credit
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setCancelling(null)}
                        className="rounded-lg border border-line px-4 py-2 text-sm text-heading"
                      >
                        Keep order
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
