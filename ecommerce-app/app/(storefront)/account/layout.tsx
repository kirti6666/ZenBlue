import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/middleware/getServerUser";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Authentication shell for every /account/* page. Navigation intentionally
 * lives only on /account, keeping orders, wishlist, returns and profile pages
 * focused on their own content.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const current = await getServerUser();
  if (!current) redirect("/login?callbackUrl=/account");

  return (
    <div className="mx-auto w-full min-w-0 max-w-page px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
      {children}
    </div>
  );
}
