import { NextRequest } from "next/server";
import { getCurrentUser, CurrentUser } from "./requireAuth";
import { hasPermission, type Permission } from "@/lib/permissions";

/**
 * Use at the top of any admin-only route handler:
 *   const admin = await requireAdmin(req, PERMISSIONS.ORDERS);
 *   if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
 *
 * This is the SECOND layer of admin protection — middleware.ts already blocks
 * page navigation to /admin/**, but every admin API route re-checks here too,
 * since API routes can be called directly regardless of which page you're on.
 *
 * IMPORTANT — the no-permission form is ADMIN ONLY.
 *
 *   requireAdmin(req)                       → full admins only
 *   requireAdmin(req, PERMISSIONS.ORDERS)   → admins, plus staff holding ORDERS
 *
 * This fails closed on purpose. Staff reach a route only when that route names
 * the permission it requires; a route that names none is treated as too
 * sensitive to delegate. The alternative — letting any staff account through
 * whenever a caller forgot the argument — silently grants a limited role access
 * to pricing, settings, invoice identity and the customer list.
 */
export async function requireAdmin(
  req: NextRequest,
  permission?: Permission
): Promise<CurrentUser | null> {
  const user = await getCurrentUser(req);
  if (!user) return null;

  // Blocked accounts keep a valid token until it expires; refuse them here too
  // rather than waiting for the refresh cycle to catch up.
  if (user.role === "admin") return user;
  if (user.role !== "staff") return null;

  if (!permission) return null;
  return hasPermission(user, permission) ? user : null;
}
