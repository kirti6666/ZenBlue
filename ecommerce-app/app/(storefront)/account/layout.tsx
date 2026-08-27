import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { AccountNav } from "@/components/storefront/AccountNav";

export const dynamic = "force-dynamic";

/**
 * Shell for every /account/* page: sidebar on the left, the page itself on the
 * right.
 *
 * The sign-in check lives here as well as in each page. That is deliberate
 * duplication — a layout is not a security boundary on its own (a child page
 * still renders if it forgets its own check), so the pages keep theirs and this
 * one exists so an unauthenticated visitor never sees the chrome flash before
 * being redirected.
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const current = await getServerUser();
  if (!current) redirect("/login?callbackUrl=/account");

  await connectDB();
  const profile = await User.findById(current.id)
    .select("name firstName lastName email")
    .lean<{ name?: string; firstName?: string; lastName?: string; email?: string } | null>();

  const name =
    [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim() ||
    profile?.name ||
    "there";

  return (
    <div className="mx-auto grid max-w-page gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-10 lg:py-10">
      <AccountNav name={name} email={profile?.email ?? current.email} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
