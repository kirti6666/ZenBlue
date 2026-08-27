import { RETURN_STATUS_LABELS } from "@/lib/returns";

/**
 * Status pill for a return request.
 *
 * Colour maps to outcome, not to position in the workflow: anything still
 * moving is neutral, a terminal success is green, a terminal failure is red.
 * That is what a customer actually reads for at a glance.
 */
const TONE: Record<string, string> = {
  requested: "bg-surface-alt text-muted",
  approved: "bg-success/10 text-success",
  pickup_scheduled: "bg-surface-alt text-heading",
  picked_up: "bg-surface-alt text-heading",
  received: "bg-surface-alt text-heading",
  qc_passed: "bg-success/10 text-success",
  qc_failed: "bg-warning/10 text-warning",
  refund_initiated: "bg-surface-alt text-heading",
  refund_processed: "bg-success/10 text-success",
  completed: "bg-success/10 text-success",
  rejected: "bg-error/10 text-error",
  cancelled: "bg-error/10 text-error",
};

export function ReturnStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-medium ${
        TONE[status] ?? "bg-surface-alt text-muted"
      }`}
    >
      {RETURN_STATUS_LABELS[status] ?? status}
    </span>
  );
}
