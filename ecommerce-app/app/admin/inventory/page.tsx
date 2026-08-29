import Link from "next/link";
import { connectDB } from "@/lib/db";
import { StockLog } from "@/models";
import { getLowStockLines } from "@/lib/inventory";
import { AdminPageHeader, Card, StatTile, TableWrap, Th, Td, EmptyState, Pill } from "@/components/admin/AdminPage";
import { StockAdjuster } from "@/components/admin/StockAdjuster";

export const dynamic = "force-dynamic";

export const metadata = { title: "Inventory" };

const REASON_LABELS: Record<string, string> = {
  manual_adjustment: "Manual adjustment",
  order_placed: "Order placed",
  order_cancelled: "Order cancelled",
  return_restock: "Returned to stock",
  return_written_off: "Written off",
  exchange_reserved: "Reserved for exchange",
  exchange_released: "Released replacement reservation",
  csv_import: "CSV import",
  erp_sync: "ERP sync",
  initial_stock: "Opening stock",
};

/**
 * Inventory screen: what is running out, and the full movement ledger that
 * explains how every level was reached.
 */
export default async function AdminInventoryPage() {
  await connectDB();
  const [lowStock, logs] = await Promise.all([
    getLowStockLines(200),
    StockLog.find({})
      .populate("product", "title slug")
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ]);

  const outOfStock = lowStock.filter((l) => l.stock <= 0);
  const running = lowStock.filter((l) => l.stock > 0);

  return (
    <>
      <AdminPageHeader
        title="Inventory"
        description="Stock levels per variant, low-stock alerts, and the full adjustment log."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="Out of stock"
          value={outOfStock.length}
          tone={outOfStock.length > 0 ? "error" : "success"}
          hint="Lines with zero units"
        />
        <StatTile
          label="Running low"
          value={running.length}
          tone={running.length > 0 ? "warning" : "default"}
          hint="At or below threshold"
        />
        <StatTile label="Movements logged" value={logs.length} hint="Most recent 100" />
      </div>

      <h2 className="mb-3 text-base font-medium text-heading">Needs attention</h2>
      {lowStock.length === 0 ? (
        <EmptyState message="Every line is comfortably in stock." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th>Variant</Th>
              <Th>SKU</Th>
              <Th>Stock</Th>
              <Th>Threshold</Th>
              <Th>Adjust</Th>
            </tr>
          </thead>
          <tbody>
            {lowStock.map((line) => (
              <tr key={`${line.productId}-${line.variantKey}`} className="hover:bg-surface-alt">
                <Td>
                  <Link href={`/admin/products/${line.productId}/edit`} className="text-link hover:underline">
                    {line.title}
                  </Link>
                </Td>
                <Td className="text-xs text-muted">{line.variantKey || "—"}</Td>
                <Td className="text-xs text-muted">{line.sku || "—"}</Td>
                <Td>
                  <Pill tone={line.stock <= 0 ? "error" : "warning"}>{line.stock}</Pill>
                </Td>
                <Td className="text-xs text-muted">{line.threshold}</Td>
                <Td>
                  <StockAdjuster
                    productId={line.productId}
                    variantKey={line.variantKey}
                    currentStock={line.stock}
                  />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <h2 className="mb-3 mt-10 text-base font-medium text-heading">Stock adjustment log</h2>
      {logs.length === 0 ? (
        <EmptyState message="No stock movements recorded yet." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Product</Th>
              <Th>Variant</Th>
              <Th>Change</Th>
              <Th>Resulting</Th>
              <Th>Reason</Th>
              <Th>By</Th>
            </tr>
          </thead>
          <tbody>
            {(logs as any[]).map((log) => (
              <tr key={String(log._id)} className="hover:bg-surface-alt">
                <Td className="whitespace-nowrap text-xs text-muted">
                  {new Date(log.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td className="text-xs">{log.product?.title ?? "—"}</Td>
                <Td className="text-xs text-muted">{log.variantKey || "—"}</Td>
                <Td className={log.delta > 0 ? "text-success" : "text-error"}>
                  {log.delta > 0 ? "+" : ""}
                  {log.delta}
                </Td>
                <Td>{log.resultingStock}</Td>
                <Td className="text-xs text-muted">
                  {REASON_LABELS[log.reason] ?? log.reason}
                  {log.note ? ` — ${log.note}` : ""}
                </Td>
                <Td className="text-xs text-muted">
                  {log.performedBy?.name ?? (log.order ? "System (order)" : "System")}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
