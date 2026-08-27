import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { ProfileForm, type ProfileValues } from "@/components/storefront/ProfileForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "My Profile" };

export default async function ProfilePage() {
  const current = await getServerUser();
  if (!current) redirect("/login?callbackUrl=/account/profile");

  await connectDB();
  const user = await User.findById(current.id)
    .select("name firstName lastName email phone phoneVerified dob gender marketingOptIn")
    .lean<{
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      phoneVerified?: boolean;
      dob?: Date;
      gender?: ProfileValues["gender"];
      marketingOptIn?: boolean;
    } | null>();

  if (!user) redirect("/login");

  // An account created by phone-only OTP carries a synthetic @phone.zenblue.local
  // address (see /api/auth/otp/verify). Showing it would look like a mistake, so
  // the field reads empty until the customer has a real one.
  const email = user.email?.endsWith("@phone.zenblue.local") ? "" : user.email ?? "";

  // Split the legacy single `name` on first save so the form is not empty for
  // customers who registered before these fields existed.
  const [legacyFirst = "", ...legacyRest] = (user.name ?? "").trim().split(/\s+/);

  const initial: ProfileValues = {
    firstName: user.firstName || legacyFirst,
    lastName: user.lastName || legacyRest.join(" "),
    email,
    phone: user.phone ?? "",
    phoneVerified: !!user.phoneVerified,
    dob: user.dob ? new Date(user.dob).toISOString().slice(0, 10) : "",
    gender: user.gender ?? "",
    marketingOptIn: !!user.marketingOptIn,
  };

  return (
    <main>
      <h1 className="font-display text-2xl font-semibold text-heading">My Profile</h1>
      <p className="mt-1 text-sm text-body">
        Keep these up to date — we use them for delivery updates and birthday offers.
      </p>
      <div className="mt-6">
        <ProfileForm initial={initial} />
      </div>
    </main>
  );
}
