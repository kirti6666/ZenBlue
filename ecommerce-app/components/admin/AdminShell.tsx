"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ExternalLink, Menu, X } from "lucide-react";
import { LogoutButton } from "@/components/storefront/LogoutButton";

interface NavGroup {
  section: string;
  items: { href: string; label: string }[];
}

/**
 * Admin chrome: a fixed sidebar on desktop, a slide-over on mobile.
 *
 * A client component because it needs the current path to highlight the active
 * link and to close the mobile drawer on navigation. The permission filtering
 * happens on the server in app/admin/layout.tsx — this only renders what it is
 * handed.
 */
export function AdminShell({
  nav,
  storeName,
  userEmail,
  userRole,
  children,
}: {
  nav: NavGroup[];
  storeName: string;
  userEmail: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // "/admin" would otherwise match every nested route.
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-5 py-4">
        <p className="font-display text-lg font-semibold tracking-[0.16em] text-heading">
          {storeName.toUpperCase()}
        </p>
        <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">
          {userRole === "admin" ? "Administrator" : "Staff"}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {nav.map((group) => (
          <div key={group.section} className="mb-5">
            <p className="eyebrow px-2 pb-2">{group.section}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                      isActive(item.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-body hover:bg-surface-alt hover:text-heading"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line px-5 py-4">
        <p className="truncate text-xs text-muted" title={userEmail}>
          {userEmail}
        </p>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-link hover:underline"
          target="_blank"
        >
          View store <ExternalLink size={11} />
        </Link>
        <LogoutButton className="text-xs text-error hover:underline" />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {/* Mobile header */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu">
          <Menu size={20} className="text-heading" />
        </button>
        <span className="text-sm font-medium text-heading">{storeName} Admin</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close admin menu"
              className="absolute right-3 top-3.5 z-10 p-1"
            >
              <X size={18} className="text-heading" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto p-5 pt-20 sm:p-8 lg:pt-8">
        {children}
      </main>
    </div>
  );
}
