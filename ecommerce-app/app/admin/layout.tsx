import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getSiteSettings } from "@/lib/site-settings";
import { canAccessAdmin, hasPermission, PERMISSIONS, type Permission } from "@/lib/permissions";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin" };

/**
 * Admin navigation, in the order the shop is actually run: what came in today,
 * then the catalogue, then the back office.
 *
 * Each entry declares the permission it needs. The sidebar renders only what
 * the signed-in user may open — but that is presentation, not security: every
 * admin API route re-checks the same permission with requireAdmin(), because a
 * hidden link is not an access control.
 */
const NAV: { section: string; items: { href: string; label: string; permission: Permission }[] }[] = [
  {
    section: "Today",
    items: [
      { href: "/admin", label: "Dashboard", permission: PERMISSIONS.DASHBOARD },
      { href: "/admin/orders", label: "Orders", permission: PERMISSIONS.ORDERS },
      { href: "/admin/returns", label: "Returns & exchanges", permission: PERMISSIONS.RETURNS },
      { href: "/admin/shipping", label: "Shipping", permission: PERMISSIONS.SHIPPING },
    ],
  },
  {
    section: "Catalogue",
    items: [
      { href: "/admin/products", label: "Products", permission: PERMISSIONS.PRODUCTS },
      { href: "/admin/inventory", label: "Inventory", permission: PERMISSIONS.INVENTORY },
      { href: "/admin/categories", label: "Categories", permission: PERMISSIONS.CATEGORIES },
      { href: "/admin/reviews", label: "Reviews", permission: PERMISSIONS.REVIEWS },
    ],
  },
  {
    section: "Customers",
    items: [
      { href: "/admin/customers", label: "Customers", permission: PERMISSIONS.CUSTOMERS },
      { href: "/admin/wallet", label: "Store credit", permission: PERMISSIONS.WALLET },
      { href: "/admin/coupons", label: "Coupons", permission: PERMISSIONS.COUPONS },
      { href: "/admin/marketing", label: "Marketing", permission: PERMISSIONS.MARKETING },
    ],
  },
  {
    section: "Back office",
    items: [
      { href: "/admin/invoices", label: "Invoices & credit notes", permission: PERMISSIONS.INVOICES },
      { href: "/admin/analytics", label: "Analytics", permission: PERMISSIONS.REPORTS },
      { href: "/admin/reports", label: "Reports & exports", permission: PERMISSIONS.REPORTS },
      { href: "/admin/notifications", label: "Notification log", permission: PERMISSIONS.NOTIFICATIONS },
      { href: "/admin/activity-log", label: "Activity log", permission: PERMISSIONS.SETTINGS },
    ],
  },
  {
    section: "Configure",
    items: [
      { href: "/admin/content", label: "Content & pages", permission: PERMISSIONS.CONTENT },
      { href: "/admin/staff", label: "Staff & permissions", permission: PERMISSIONS.STAFF },
      { href: "/admin/erp", label: "ERP sync", permission: PERMISSIONS.SETTINGS },
      { href: "/admin/settings", label: "Settings", permission: PERMISSIONS.SETTINGS },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!canAccessAdmin(user)) redirect("/login?callbackUrl=/admin");

  const settings = await getSiteSettings();

  const nav = NAV.map((group) => ({
    section: group.section,
    items: group.items.filter((item) => hasPermission(user, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <AdminShell
      nav={nav}
      storeName={settings.brand.storeName}
      userEmail={user!.email}
      userRole={user!.role}
    >
      {children}
    </AdminShell>
  );
}
