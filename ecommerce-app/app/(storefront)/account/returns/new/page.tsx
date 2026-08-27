import { redirect } from "next/navigation";
import { PageHeader } from "@/components/storefront/PageHeader";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { ReturnRequestForm } from "@/components/storefront/ReturnRequestForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Request a return" };

/**
 * Return/exchange request form.
 *
 * Reached from an order in My Account with `?orderId=`. Eligibility and the
 * returnable quantities are fetched client-side from /api/returns/eligibility
 * so the same rules that the POST enforces are the ones the form renders.
 */
export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?callbackUrl=/account/orders");
  if (!searchParams.orderId) redirect("/account/orders");

  return (
    <main>
      <PageHeader
        title="Request a return or exchange"
        subtitle="Choose the items you want to send back and tell us what went wrong."
        breadcrumbs={[
          { name: "My Account", path: "/account" },
          { name: "Orders", path: "/account/orders" },
          { name: "Request return", path: "/account/returns/new" },
        ]}
      />
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-6 sm:py-12">
        <ReturnRequestForm orderId={searchParams.orderId} />
      </div>
    </main>
  );
}
