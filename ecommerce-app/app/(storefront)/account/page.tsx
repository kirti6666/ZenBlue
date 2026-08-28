import { redirect } from "next/navigation";
import { AccountNav } from "@/components/storefront/AccountNav";
import { connectDB } from "@/lib/db";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { User } from "@/models";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Account" };

/** Account hub: navigation only. Every destination owns its own focused page. */
export default async function AccountPage() {
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
    <main className="mx-auto w-full max-w-md" aria-labelledby="account-heading">
      <header className="mb-3 px-0.5">
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted">Your ZenBlue</p>
        <h1 id="account-heading" className="mt-0.5 font-display text-2xl font-semibold text-heading">
          My Account
        </h1>
      </header>
      <AccountNav name={name} email={profile?.email ?? current.email} />
    </main>
  );
}
