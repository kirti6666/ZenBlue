/**
 * Role & permission model for the admin panel.
 *
 * Two roles reach /admin:
 *   - `admin` — implicitly holds every permission. Cannot be locked out of a
 *     section by configuration, which is what makes it the recovery role.
 *   - `staff` — holds only the permissions explicitly granted on the user.
 *
 * Permissions are coarse, one per admin section, rather than per-action CRUD.
 * That matches how a small clothing team actually delegates ("Priya handles
 * orders and returns, she does not touch pricing"), and keeps the grant UI to
 * a single checklist instead of a matrix nobody maintains.
 */

export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  PRODUCTS: "products",
  INVENTORY: "inventory",
  CATEGORIES: "categories",
  ORDERS: "orders",
  RETURNS: "returns",
  SHIPPING: "shipping",
  CUSTOMERS: "customers",
  COUPONS: "coupons",
  REVIEWS: "reviews",
  CONTENT: "content",
  INVOICES: "invoices",
  WALLET: "wallet",
  NOTIFICATIONS: "notifications",
  MARKETING: "marketing",
  REPORTS: "reports",
  SETTINGS: "settings",
  STAFF: "staff",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

/** Human labels for the staff-permission checklist in the admin UI. */
export const PERMISSION_LABELS: Record<Permission, string> = {
  dashboard: "Dashboard",
  products: "Products",
  inventory: "Inventory & stock",
  categories: "Categories",
  orders: "Orders",
  returns: "Returns & exchanges",
  shipping: "Shipping & AWB",
  customers: "Customers",
  coupons: "Coupons & discounts",
  reviews: "Reviews moderation",
  content: "Content & pages",
  invoices: "Invoices & credit notes",
  wallet: "Store credit",
  notifications: "Notification log",
  marketing: "Marketing & abandoned carts",
  reports: "Reports & exports",
  settings: "Site settings",
  staff: "Staff & permissions",
};

/**
 * A sensible starting grant for a new staff member: run the shop day to day,
 * but no pricing, settings, or ability to create more staff.
 */
export const DEFAULT_STAFF_PERMISSIONS: Permission[] = [
  PERMISSIONS.DASHBOARD,
  PERMISSIONS.ORDERS,
  PERMISSIONS.RETURNS,
  PERMISSIONS.SHIPPING,
  PERMISSIONS.CUSTOMERS,
  PERMISSIONS.INVENTORY,
  PERMISSIONS.REVIEWS,
];

export interface PermissionSubject {
  role?: string;
  permissions?: string[];
}

/** Admins bypass the list entirely; staff are checked against their grants. */
export function hasPermission(user: PermissionSubject | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.role !== "staff") return false;
  return (user.permissions ?? []).includes(perm);
}

/** True if the user may reach the admin panel at all. */
export function canAccessAdmin(user: PermissionSubject | null | undefined): boolean {
  return user?.role === "admin" || user?.role === "staff";
}
