import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/middleware/getServerUser";

export const dynamic = "force-dynamic";

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
