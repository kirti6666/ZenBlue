"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  LayoutGrid,
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
 * path; everything it links to is rendered on the server. On phones the same
 * list becomes a horizontal scroller above the content rather than collapsing
 * into a menu — an account section has few enough destinations that hiding
 * them behind another tap costs more than the width does.
 */
const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutGrid },
  { href: "/account/orders", label: "My Orders", icon: Package },
  { href: "/account/returns", label: "Returns & Exchanges", icon: RotateCcw },
  { href: "/account/wallet", label: "My Wallet", icon: Wallet },
  { href: "/account/wishlist", label: "My Wishlist", icon: Heart },
  { href: "/account/addresses", label: "My Addresses", icon: MapPin },
  { href: "/account/profile", label: "My Profile", icon: UserIcon },
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
    <aside className="lg:sticky lg:top-24">
      <div className="mb-4 hidden rounded-xl border border-line bg-surface p-4 lg:block">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">Hello</p>
        <p className="mt-1 truncate font-medium text-heading">{name}</p>
        <p className="truncate text-xs text-muted">{email}</p>
      </div>

      <nav
        aria-label="Account"
        className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = active === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-sm transition-colors lg:shrink ${
                isActive
                  ? "bg-surface-alt font-medium text-heading"
                  : "text-body hover:bg-surface-alt hover:text-heading"
              }`}
            >
              <Icon size={16} strokeWidth={1.7} />
              {label}
            </Link>
          );
        })}

        <LogoutButton className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg px-3.5 py-2.5 text-left text-sm text-body transition-colors hover:bg-surface-alt hover:text-heading lg:shrink" />
      </nav>
    </aside>
  );
}
