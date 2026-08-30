import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, ExternalLink, Search } from "lucide-react";
import { connectDB } from "@/lib/db";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { BackInStockRequest } from "@/models";
import {
  AdminPageHeader,
  EmptyState,
  Pill,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/AdminPage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Back-in-stock requests" };

const STATUS_FILTERS = [
  { value: "waiting", label: "Waiting" },
  { value: "notified", label: "Notified" },
  { value: "cancelled", label: "Cancelled" },
  { value: "", label: "All" },
] as const;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function BackInStockRequestsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string };
}) {
  const user = await getServerUser();
  if (!hasPermission(user, PERMISSIONS.INVENTORY)) redirect("/admin");

  await connectDB();
  const requestedStatus = searchParams.status ?? "waiting";
  const status =
    requestedStatus === "all"
      ? ""
      : ["waiting", "notified", "cancelled"].includes(requestedStatus)
        ? requestedStatus
        : "waiting";
  const queryText = (searchParams.q ?? "").trim().slice(0, 120);
  const filter: Record<string, unknown> = status ? { status } : {};
  if (queryText) {
    filter.$or = [
      { email: { $regex: escapeRegex(queryText), $options: "i" } },
      { phone: { $regex: escapeRegex(queryText), $options: "i" } },
      { variantKey: { $regex: escapeRegex(queryText), $options: "i" } },
    ];
  }

  const [requests, counts] = await Promise.all([
    BackInStockRequest.find(filter)
      .populate("product", "title slug")
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean<any[]>(),
    BackInStockRequest.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  const countBy = Object.fromEntries(counts.map((row: any) => [row._id, row.count]));

  return (
    <>
      <AdminPageHeader
        title="Back-in-stock requests"
        description="Customers waiting for a sold-out product or variant. Restocking the exact variant automatically sends its alert."
        actions={
          <Link
            href="/admin/inventory"
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-heading hover:border-primary"
          >
            View inventory <ExternalLink size={14} />
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Waiting"
          value={countBy.waiting ?? 0}
          tone={(countBy.waiting ?? 0) > 0 ? "warning" : "default"}
          hint="Pending restock alerts"
        />
        <StatTile
          label="Notified"
          value={countBy.notified ?? 0}
          tone="success"
          hint="Alerts already triggered"
        />
        <StatTile
          label="Total requests"
          value={Object.values(countBy).reduce((sum: number, value: any) => sum + Number(value), 0)}
          hint="Across every status"
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((item) => {
            const active = (status ?? "") === item.value;
            const href = item.value
              ? `/admin/back-in-stock?status=${item.value}`
              : "/admin/back-in-stock?status=all";
            return (
              <Link
                key={item.label}
                href={href}
                className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-surface text-body hover:border-primary"
                }`}
              >
                {item.label}
                {item.value && countBy[item.value] ? ` (${countBy[item.value]})` : ""}
              </Link>
            );
          })}
        </div>

        <form className="relative w-full lg:w-72" method="get">
          {status && <input type="hidden" name="status" value={status} />}
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={queryText}
            placeholder="Search email or variant"
            className="w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-sm text-heading outline-none focus:border-primary"
          />
        </form>
      </div>

      {requests.length === 0 ? (
        <EmptyState
          message={
            queryText
              ? "No back-in-stock requests match this search."
              : status === "waiting"
                ? "No customers are currently waiting for a restock."
                : "No requests in this status."
          }
        />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Requested</Th>
              <Th>Product</Th>
              <Th>Variant</Th>
              <Th>Customer</Th>
              <Th>Status</Th>
              <Th>Notified</Th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request: any) => (
              <tr key={String(request._id)} className="hover:bg-surface-alt">
                <Td className="whitespace-nowrap text-xs text-muted">
                  {new Date(request.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Td>
                <Td>
                  {request.product ? (
                    <Link
                      href={`/product/${request.product.slug}`}
                      target="_blank"
                      className="font-medium text-link hover:underline"
                    >
                      {request.product.title}
                    </Link>
                  ) : (
                    <span className="text-muted">Deleted product</span>
                  )}
                </Td>
                <Td className="text-xs text-muted">{request.variantKey || "All variants"}</Td>
                <Td>
                  {request.email ? (
                    <a href={`mailto:${request.email}`} className="text-link hover:underline">
                      {request.email}
                    </a>
                  ) : request.phone ? (
                    <a href={`tel:${request.phone}`} className="text-link hover:underline">
                      {request.phone}
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  {request.user?.name && (
                    <p className="mt-0.5 text-xs text-muted">{request.user.name}</p>
                  )}
                </Td>
                <Td>
                  <Pill
                    tone={
                      request.status === "waiting"
                        ? "warning"
                        : request.status === "notified"
                          ? "success"
                          : "default"
                    }
                  >
                    {request.status === "waiting" && <BellRing size={11} className="mr-1 inline" />}
                    {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </Pill>
                </Td>
                <Td className="whitespace-nowrap text-xs text-muted">
                  {request.notifiedAt
                    ? new Date(request.notifiedAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
