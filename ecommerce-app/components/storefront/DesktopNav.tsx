"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { NavLink } from "@/lib/site-settings";
import { DEFAULT_MEGA_MENU_IMAGES } from "@/lib/site-settings-constants";

/**
 * Desktop primary navigation. Submenus are click-controlled so the large menu
 * cannot disappear while the pointer travels from the trigger into its links.
 */
export function DesktopNav({ navLinks }: { navLinks: NavLink[] }) {
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function cancelScheduledClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function openMenu(label: string) {
    cancelScheduledClose();
    setOpenLabel(label);
  }

  function scheduleClose() {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => {
      setOpenLabel(null);
      closeTimer.current = null;
    }, 220);
  }

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenLabel(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenLabel(null);
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelScheduledClose();
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Main"
      onMouseEnter={cancelScheduledClose}
      onMouseLeave={scheduleClose}
      className="hidden items-center gap-3 xl:flex 2xl:gap-5"
    >
      {navLinks.map((link) => {
        const children = link.children ?? [];
        const hasChildren = children.length > 0;

        return (
          <div
            key={link.label}
            className="group"
            onMouseEnter={() => {
              if (hasChildren) openMenu(link.label);
            }}
          >
            {hasChildren ? (
              <button
                type="button"
                onClick={() => openMenu(link.label)}
              // whitespace-nowrap is load-bearing: "T SHIRTS" and "BULK ORDERS"
              // wrap onto two lines without it, which breaks the header's
              // baseline and pushes the row taller than the logo.
                className="inline-flex items-center gap-1 whitespace-nowrap py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-heading transition-colors hover:text-link 2xl:text-[11px] 2xl:tracking-[0.1em]"
                aria-haspopup="menu"
                aria-expanded={openLabel === link.label}
                aria-controls={`desktop-menu-${link.label.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {link.label}
                <ChevronDown
                  size={12}
                  className={`text-muted transition-transform ${openLabel === link.label ? "rotate-180" : ""}`}
                />
              </button>
            ) : (
              <Link
                href={link.href || "#"}
                className="inline-flex items-center whitespace-nowrap py-2 text-[10px] font-medium uppercase tracking-[0.08em] text-heading transition-colors hover:text-link 2xl:text-[11px] 2xl:tracking-[0.1em]"
              >
                {link.label}
              </Link>
            )}

            {hasChildren && openLabel === link.label && (
              <div
                id={`desktop-menu-${link.label.replace(/\s+/g, "-").toLowerCase()}`}
                onMouseEnter={cancelScheduledClose}
                onMouseLeave={scheduleClose}
                className="absolute left-0 right-0 top-full z-50 border-t border-line bg-background shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenLabel(null)}
                  aria-label="Close navigation menu"
                  className="absolute right-5 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-background text-heading transition hover:rotate-90 hover:bg-surface-alt"
                >
                  <X size={17} />
                </button>
                <div className="grid max-h-[70vh] grid-cols-[280px_minmax(0,1fr)] overflow-y-auto 2xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="border-r border-line bg-surface-alt px-8 py-7 2xl:px-12">
                    <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
                      Explore {link.label}
                    </p>
                    <ul className="space-y-0.5">
                      {children.map((child) => (
                        <li key={child.label}>
                          <Link
                            href={child.href || "#"}
                            onClick={() => setOpenLabel(null)}
                            className="block border-b border-transparent py-2.5 text-[12px] font-medium uppercase tracking-[0.13em] text-heading transition-all hover:border-heading hover:pl-1"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid grid-cols-3 gap-5 p-7 2xl:gap-7 2xl:p-9">
                    {children.slice(0, 3).map((child, index) => (
                      <Link
                        key={`${link.label}-${child.label}`}
                        href={child.href || "#"}
                        onClick={() => setOpenLabel(null)}
                        className="group/card relative aspect-[4/3] overflow-hidden rounded-lg bg-surface-alt"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={link.promoImages?.[index] || DEFAULT_MEGA_MENU_IMAGES[index]}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-[1.04]"
                        />
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-5 pb-5 pt-14 text-sm font-semibold uppercase tracking-[0.14em] text-white">
                          {child.label}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
