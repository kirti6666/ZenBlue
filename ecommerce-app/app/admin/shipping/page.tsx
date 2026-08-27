import Link from "next/link";
import { connectDB } from "@/lib/db";
import { Order, Shipment } from "@/models";
import { getSiteSettings, formatPrice } from "@/lib/site-settings";
import { AdminPageHeader, TableWrap, Th, Td, EmptyState, Pill, StatTile, Card } from "@/components/admin/AdminPage";
import { ShipmentActions } from "@/components/admin/ShipmentActions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Shipping" };

function toneFor(status: string): "default" | "success" | "warning" | "error" | "info" {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "failed") return "error";
  if (status.startsWith("rto")) return "warning";
  if (status === "out_for_delivery" || status === "in_transit") return "info";
  return "default";
}

/**
 * Shipping desk: orders waiting to be dispatched at the top (that is the
 * actionable list), the shipment register below it.
 */
export default async function AdminShippingPage() {
  await connectDB();

  const [awaiting, shipments, settings] = await Promise.all([
    Order.find({
      orderStatus: { $in: ["placed", "confirmed", "processing"] },
      // COD orders ship without payment; prepaid must be paid first.
      $or: [{ paymentStatus: "paid" }, { paymentMethod: "cod" }],
    })
      .sort({ createdAt: 1 })
      .limit(100)
      .lean(),
    Shipment.find({})
      .populate("order", "orderNumber total shippingAddress")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    getSiteSettings(),
  ]);

  const symbol = settings.commerce.currencySymbol;
  const inTransit = (shipments as any[]).filter((s) =>
    ["awb_assigned", "picked_up", "in_transit", "out_for_delivery"].includes(s.status)
  );
  const delivered = (shipments as any[]).filter((s) => s.status === "delivered");

  return (
    <>
      <AdminPageHeader
        title="Shipping"
        description={`Courier: ${settings.shipping.provider === "manual" ? "manual AWB entry" : settings.shipping.provider}. Change it under Settings → Shipping.`}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Awaiting dispatch"
          value={awaiting.length}
          tone={awaiting.length > 0 ? "warning" : "success"}
          hint="Paid or COD, not yet shipped"
        />
        <StatTile label="In transit" value={inTransit.length} />
        <StatTile label="Delivered" value={delivered.length} tone="success" />
      </div>

      {!settings.shipping.pickupPincode && (
        <Card className="mb-6 border-warning/40">
          <p className="text-sm text-heading">
            Set your pickup pincode under{" "}
            <Link href="/admin/settings" className="text-link underline">
              Settings → Shipping
            </Link>{" "}
            to enable courier rate comparison.
          </p>
        </Card>
      )}

      <h2 className="mb-3 text-base font-medium text-heading">Awaiting dispatch</h2>
      {awaiting.length === 0 ? (
        <EmptyState message="Nothing waiting to go out. Everything paid has shipped." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Ship to</Th>
              <Th>Value</Th>
              <Th>Payment</Th>
              <Th>Placed</Th>
              <Th>Book shipment</Th>
            </tr>
          </thead>
          <tbody>
            {(awaiting as any[]).map((o) => (
              <tr key={String(o._id)} className="hover:bg-surface-alt">
                <Td className="font-medium">{o.orderNumber}</Td>
                <Td>
                  <span className="block text-xs">{o.shippingAddress.fullName}</span>
                  <span className="block text-xs text-muted">
                    {o.shippingAddress.city}, {o.shippingAddress.state} — {o.shippingAddress.pincode}
                  </span>
                </Td>
                <Td className="tabular-nums">{formatPrice(o.total, symbol)}</Td>
                <Td>
                  <Pill tone={o.paymentStatus === "paid" ? "success" : "warning"}>
                    {o.paymentMethod === "cod" ? "COD" : "Prepaid"}
                  </Pill>
                </Td>
                <Td className="text-xs text-muted">
                  {new Date(o.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Td>
                <Td>
                  <ShipmentActions orderId={String(o._id)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <h2 className="mb-3 mt-10 text-base font-medium text-heading">Shipment register</h2>
      {shipments.length === 0 ? (
        <EmptyState message="No shipments booked yet." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Direction</Th>
              <Th>Courier</Th>
              <Th>AWB</Th>
              <Th>Status</Th>
              <Th>Booked</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {(shipments as any[]).map((s) => (
              <tr key={String(s._id)} className="hover:bg-surface-alt">
                <Td className="font-medium">{s.order?.orderNumber ?? "—"}</Td>
                <Td>
                  <Pill tone={s.direction === "reverse" ? "warning" : "default"}>
                    {s.direction === "reverse" ? "Reverse" : "Forward"}
                  </Pill>
                </Td>
                <Td className="text-xs">{s.courierName || "—"}</Td>
                <Td className="font-mono text-xs">{s.awb || "—"}</Td>
                <Td>
                  <Pill tone={toneFor(s.status)}>{s.status.replace(/_/g, " ")}</Pill>
                </Td>
                <Td className="text-xs text-muted">
                  {new Date(s.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </Td>
                <Td>
                  <div className="flex gap-3">
                    {s.trackingUrl && (
                      <a
                        href={s.trackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-link hover:underline"
                      >
                        Track
                      </a>
                    )}
                    {s.labelUrl && (
                      <a
                        href={s.labelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-link hover:underline"
                      >
                        Label
                      </a>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
