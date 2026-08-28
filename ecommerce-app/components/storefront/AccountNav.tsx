"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  Heart,
  LayoutGrid,
  LogOut,
  MapPin,
  Package,
  RotateCcw,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { LogoutButton } from "./LogoutButton";

/**
 * Left-hand navigation for the account area.
 *
 * A client component only because the active row is derived from the current
 * path; everything it links to is rendered on the server. The destinations
 * remain a compact vertical list at every breakpoint so account tools are
 * predictable and easy to scan on touch screens as well as desktop.
 */
const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutGrid },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/returns", label: "Returns & Exchanges", icon: RotateCcw },
  { href: "/account/profile", label: "My Account", icon: UserIcon },
  { href: "/account/wallet", label: "My Wallet", icon: Wallet },
  { href: "/account/wishlist", label: "My Wishlist", icon: Heart },
  { href: "/account/addresses", label: "My Addresses", icon: MapPin },
];

export function AccountNav({ name, email }: { name: string; email: string }) {
  const pathname = usePathname() ?? "";

  // Longest-prefix match, so /account/orders/abc123 highlights "My Orders"
  // while plain /account does not swallow every child route.
  const active = LINKS.reduce((best, link) => {
    if (pathname === link.href || pathname.startsWith(`${link.href}/`)) {
      return !best || link.href.length > best.length ? link.href : best;
    }
    return best;
  }, "");

  return (
    <aside className="min-w-0 max-w-full md:sticky md:top-24 md:self-start">
      <div className="mb-2.5 flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-sm">
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-surface-alt text-heading">
          <UserIcon size={17} strokeWidth={1.6} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted">My account</p>
          <p className="truncate text-sm font-medium text-heading">{name}</p>
          <p className="truncate text-[11px] text-muted">{email}</p>
        </div>
      </div>

      <nav
        aria-label="Account"
        className="overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-sm"
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = active === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`group flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-[13px] transition-colors ${
                isActive
                  ? "border-l-primary bg-surface-alt font-medium text-heading"
                  : "border-l-transparent text-body hover:bg-surface-alt hover:text-heading"
              }`}
            >
              <Icon size={16} strokeWidth={1.65} className="shrink-0 text-muted group-hover:text-heading" />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <ChevronRight size={13} strokeWidth={1.6} className="shrink-0 text-muted/70" />
            </Link>
          );
        })}

        <div className="mx-3 my-1 border-t border-line" />
        <LogoutButton className="group flex w-full items-center gap-3 rounded-lg border-l-2 border-l-transparent px-3 py-2 text-left text-[13px] text-body transition-colors hover:bg-surface-alt hover:text-heading">
          <LogOut size={16} strokeWidth={1.65} className="shrink-0 text-muted group-hover:text-heading" />
          <span className="min-w-0 flex-1">Sign out</span>
          <ChevronRight size={13} strokeWidth={1.6} className="shrink-0 text-muted/70" />
        </LogoutButton>
      </nav>
    </aside>
  );
}
