import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { AdminPageHeader } from "@/components/admin/AdminPage";
import { StaffManager } from "@/components/admin/StaffManager";

export const dynamic = "force-dynamic";

export const metadata = { title: "Staff & permissions" };

/**
 * Staff & permissions.
 *
 * Guarded on role === "admin" specifically rather than on a permission: if
 * managing staff were itself a grantable permission, a staff member holding it
 * could promote themselves to admin, which would make the restricted role
 * meaningless.
 */
export default async function AdminStaffPage() {
  const user = await getServerUser();
  if (user?.role !== "admin") redirect("/admin");

  await connectDB();
  const staff = await User.find({ role: { $in: ["staff", "admin"] } })
    .select("name email role permissions twoFactorEnabled isBlocked lastLoginAt createdAt")
    .sort({ role: 1, createdAt: 1 })
    .lean();

  return (
    <>
      <AdminPageHeader
        title="Staff & permissions"
        description="Give your team access to only the parts of the admin they need."
      />
      <StaffManager
        initialStaff={JSON.parse(JSON.stringify(staff))}
        currentUserId={user.id}
      />
    </>
  );
}
