import { Suspense } from "react";
import { PageHeader } from "@/components/storefront/PageHeader";
import { CartRestore } from "@/components/storefront/CartRestore";

export const metadata = { title: "Restoring your cart" };

/**
 * Landing page for the abandoned-cart recovery link. The actual restore has to
 * happen client-side because the cart lives in localStorage.
 */
export default function CartRestorePage() {
  return (
    <main>
      <PageHeader
        title="Picking up where you left off"
        subtitle="Give us a moment while we put your cart back together."
        align="center"
      />
      <div className="mx-auto max-w-md px-6 py-16">
        <Suspense fallback={<p className="text-center text-sm text-muted">Loading…</p>}>
          <CartRestore />
        </Suspense>
      </div>
    </main>
  );
}
