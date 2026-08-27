"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CircleHelp, Menu, MessageCircle, PackageSearch, Plus, ShoppingBag, UserRound, X } from "lucide-react";
import type { NavLink } from "@/lib/site-settings";

/**
 * Slide-in navigation for small screens.
 *
 * The quotation expects the majority of traffic to arrive from Instagram and
 * WhatsApp, i.e. on a phone — so the mobile drawer carries the full nav
 * including category children, not a trimmed subset of it.
 */
export function MobileNav({
  navLinks,
  isLoggedIn,
  accountHref,
  storeName,
}: {
  navLinks: NavLink[];
  isLoggedIn: boolean;
  accountHref: string;
  storeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const pathname = usePathname();

  // Any navigation closes the drawer — App Router keeps the component mounted
  // across route changes, so it would otherwise stay open over the new page.
  useEffect(() => {
    setOpen(false);
    setExpanded(null);
  }, [pathname]);

  // Prevent the page behind the drawer from scrolling while it is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt xl:hidden"
      >
        <Menu size={20} strokeWidth={1.6} />
      </button>

      {open && createPortal(
        // Full screen, not a side drawer: below xl the menu IS the page while
        // it is open. A drawer leaves a strip of the page behind it that reads
        // as still-tappable and competes with the links for attention.
        <div className="fixed inset-0 z-[100] isolate bg-background xl:hidden">
          <nav aria-label="Main" className="flex h-[100dvh] w-full flex-col bg-background">
            <div className="grid grid-cols-[44px_1fr_44px] items-center border-b border-line px-3 py-3.5">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt"
              >
                <X size={22} />
              </button>
              <Link
                href="/"
                className="justify-self-center font-display text-lg font-semibold uppercase tracking-[0.2em] text-heading"
              >
                {storeName}
              </Link>
              <Link
                href="/cart"
                aria-label="Cart"
                className="flex h-10 w-10 items-center justify-center justify-self-end rounded-full text-heading transition-colors hover:bg-surface-alt"
              >
                <ShoppingBag size={20} strokeWidth={1.6} />
              </Link>
            </div>

            <div className="flex items-center justify-between bg-surface-alt px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-background text-heading ring-1 ring-line">
                  <UserRound size={18} strokeWidth={1.6} />
                </span>
                <span className="font-display text-base font-semibold text-heading">
                  {isLoggedIn ? "Welcome back" : "Welcome"}
                </span>
              </div>
              <Link
                href={isLoggedIn ? accountHref : "/login"}
                className="rounded-full bg-heading px-4 py-2 font-display text-[13px] font-semibold text-background transition-transform hover:scale-105"
              >
                {isLoggedIn ? "My Account" : "Login / Register"}
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="px-5 py-2">
              {navLinks.map((link) => {
                const hasChildren = !!link.children?.length;
                const isExpanded = expanded === link.label;
                return (
                  <div key={link.label} className="border-b border-line last:border-0">
                    {hasChildren ? (
                      <button
                        type="button"
                        onClick={() => setExpanded(isExpanded ? null : link.label)}
                        aria-expanded={isExpanded}
                        aria-controls={`mobile-menu-${link.label.replace(/\s+/g, "-").toLowerCase()}`}
                        className="flex w-full items-center justify-between py-4 text-left font-display text-base font-semibold uppercase tracking-[0.055em] text-heading"
                      >
                        <span>{link.label}</span>
                        <span className="flex h-8 w-8 items-center justify-center">
                          <Plus
                            size={20}
                            className={`transition-transform duration-200 ${isExpanded ? "rotate-45" : ""}`}
                          />
                        </span>
                      </button>
                    ) : (
                      <Link
                        href={link.href || "#"}
                        onClick={() => setOpen(false)}
                        className="block py-4 font-display text-base font-semibold uppercase tracking-[0.055em] text-heading"
                      >
                        {link.label}
                      </Link>
                    )}
                    {hasChildren && isExpanded && (
                      <ul
                        id={`mobile-menu-${link.label.replace(/\s+/g, "-").toLowerCase()}`}
                        className="-mx-2 mb-3 rounded-lg bg-surface-alt px-4 py-2"
                      >
                        {link.children!.map((child) => (
                          <li key={child.label}>
                            <Link
                              href={child.href || "#"}
                              onClick={() => setOpen(false)}
                              className="block border-b border-line/60 py-3 font-display text-sm font-medium text-body transition-colors last:border-0 hover:text-link"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
              </div>

              <div className="mt-2 space-y-0.5 bg-surface-alt px-5 py-4">
                {[
                  { href: isLoggedIn ? accountHref : "/login", label: "My Account", Icon: UserRound },
                  { href: "/track-order", label: "Track Order", Icon: PackageSearch },
                  { href: "/faq", label: "FAQ", Icon: CircleHelp },
                  { href: "/contact", label: "Contact Us", Icon: MessageCircle },
                ].map(({ href, label, Icon }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex items-center gap-4 rounded-lg px-2 py-3 font-display text-[15px] font-semibold uppercase tracking-[0.045em] text-heading transition-colors hover:bg-background"
                  >
                    <Icon size={19} strokeWidth={1.5} />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="bg-heading px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center text-[10px] font-semibold uppercase tracking-[0.24em] text-background">
              {storeName} · Premium Menswear
            </div>
          </nav>
        </div>,
        document.body
      )}
    </>
  );
}
