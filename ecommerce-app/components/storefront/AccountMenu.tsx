"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, Package, User as UserIcon, Wallet } from "lucide-react";
import { LoginModal } from "./LoginModal";
import { LogoutButton } from "./LogoutButton";

/**
 * The account icon in the header.
 *
 * Signed out, it opens the OTP popup in place rather than navigating to
 * /login — a shopper who taps it from a product page should not lose the page
 * they were on. Signed in, it drops down the handful of destinations that make
 * up the account area.
 *
 * Staff never get the dropdown: their icon goes straight to /admin, since the
 * customer-facing wallet and wishlist links are not what they are reaching for.
 */
export function AccountMenu({
  name,
  isStaff,
  isLoggedIn,
}: {
  name: string;
  isStaff: boolean;
  isLoggedIn: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  if (isStaff) {
    return (
      <Link
        href="/admin"
        aria-label="Admin dashboard"
        className="flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt hover:text-link"
      >
        <UserIcon size={19} strokeWidth={1.6} />
      </Link>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          aria-label="Sign in"
          className="flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt hover:text-link"
        >
          <UserIcon size={19} strokeWidth={1.6} />
        </button>
        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          callbackUrl={pathname ?? "/account"}
        />
      </>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="My account"
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        className="flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt hover:text-link"
      >
        <UserIcon size={19} strokeWidth={1.6} />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-background py-1.5 shadow-lg"
        >
          <p className="truncate px-4 pb-2 pt-1 text-sm font-medium text-heading">Hi {name}</p>
          <div className="border-t border-line" />

          {[
            { href: "/account", label: "My Account", icon: LayoutGrid },
            { href: "/account/orders", label: "My Orders", icon: Package },
            { href: "/account/wishlist", label: "My Wishlist", icon: Heart },
            { href: "/account/wallet", label: "My Wallet", icon: Wallet },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-body transition-colors hover:bg-surface-alt hover:text-heading"
            >
              <Icon size={15} strokeWidth={1.7} />
              {label}
            </Link>
          ))}

          <div className="border-t border-line" />
          <LogoutButton className="w-full px-4 py-2.5 text-left text-sm text-body transition-colors hover:bg-surface-alt hover:text-heading" />
        </div>
      )}
    </div>
  );
}
