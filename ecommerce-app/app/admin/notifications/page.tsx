import Link from "next/link";
import { connectDB } from "@/lib/db";
import { NotificationLog } from "@/models";
import { AdminPageHeader, TableWrap, Th, Td, EmptyState, Pill, StatTile } from "@/components/admin/AdminPage";
import { RetryNotificationsButton } from "@/components/admin/RetryNotificationsButton";

export const dynamic = "force-dynamic";

export const metadata = { title: "Notification log" };

const FILTERS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

/**
 * Per-message send log across email, WhatsApp and SMS.
 *
 * "Skipped" is deliberately distinct from "failed": it means the provider is
 * not configured yet (no WhatsApp onboarding, no DLT registration), which is
 * expected during setup and is not something a retry can fix.
 */
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: { status?: string; channel?: string };
}) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (searchParams.status) filter.status = searchParams.status;
  if (searchParams.channel) filter.channel = searchParams.channel;

  const [logs, counts] = await Promise.all([
    NotificationLog.find(filter)
      .populate("user", "name email")
      .populate("order", "orderNumber")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    NotificationLog.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const countBy = Object.fromEntries(counts.map((c: any) => [c._id, c.count]));

  return (
    <>
      <AdminPageHeader
        title="Notification log"
        description="Every email, WhatsApp and SMS the store attempted to send, with its delivery outcome."
        actions={<RetryNotificationsButton failedCount={countBy.failed ?? 0} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Delivered" value={countBy.sent ?? 0} tone="success" />
        <StatTile
          label="Failed"
          value={countBy.failed ?? 0}
          tone={(countBy.failed ?? 0) > 0 ? "error" : "default"}
          hint="Retried automatically up to 3 times"
        />
        <StatTile
          label="Skipped"
          value={countBy.skipped ?? 0}
          hint="Channel not configured yet"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/notifications?status=${f.value}` : "/admin/notifications"}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-colors ${
              (searchParams.status ?? "") === f.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-line text-body hover:border-primary"
            }`}
          >
            {f.label}
            {f.value && countBy[f.value] ? ` (${countBy[f.value]})` : ""}
          </Link>
        ))}
      </div>

      {logs.length === 0 ? (
        <EmptyState message="No notifications logged yet." />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Event</Th>
              <Th>Channel</Th>
              <Th>Recipient</Th>
              <Th>Order</Th>
              <Th>Status</Th>
              <Th>Detail</Th>
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
                <Td className="text-xs">{log.event.replace(/_/g, " ")}</Td>
                <Td>
                  <Pill tone="info">{log.channel}</Pill>
                </Td>
                <Td className="text-xs text-muted">{log.recipient}</Td>
                <Td className="text-xs">{log.order?.orderNumber ?? "—"}</Td>
                <Td>
                  <Pill
                    tone={
                      log.status === "sent"
                        ? "success"
                        : log.status === "failed"
                          ? "error"
                          : "default"
                    }
                  >
                    {log.status}
                  </Pill>
                </Td>
                <Td className="max-w-xs truncate text-xs text-muted" title={log.error || log.subject}>
                  {log.error || log.subject || "—"}
                  {log.attempts > 1 && ` (${log.attempts} attempts)`}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
