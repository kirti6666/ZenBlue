import type { Metadata } from "next";
import { PageHeader } from "@/components/storefront/PageHeader";
import { TrackOrderForm } from "@/components/storefront/TrackOrderForm";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Track a ZenBlue order using your order number and the email or phone used to place it.",
  alternates: { canonical: "/track-order" },
};

/**
 * Public order tracking.
 *
 * Exists because guest checkout is supported — a guest has no account to log
 * into, but still needs to see where their parcel is. Verification is order
 * number + the contact detail used at checkout, so knowing an order number
 * alone is not enough to read someone else's address.
 */
export default function TrackOrderPage() {
  return (
    <main>
      <PageHeader
        title="Track your order"
        subtitle="Enter your order number and the email or phone number you used at checkout."
        breadcrumbs={[{ name: "Track Order", path: "/track-order" }]}
        compact
      />
      <div className="mx-auto max-w-[760px] px-4 py-5 sm:px-6 sm:py-8">
        <TrackOrderForm />
      </div>
    </main>
  );
}
