import Link from "next/link";
import { getSiteSettings } from "@/lib/site-settings";

const ANNOUNCEMENTS = [
  { text: "Free shipping for all orders", href: "/shop" },
  { text: "Limited stock on selected styles", href: "/shop" },
  { text: "Bulk orders for teams & businesses", href: "/bulk-orders" },
  { text: "Customize your shirts & T-shirts", href: "/customization" },
  { text: "Extra off on prepaid orders", href: "/shop" },
  { text: "Plus sizes up to 6XL", href: "/shop" },
  { text: "First order? Use ZENTEN for 10% off", href: "/shop" },
] as const;

function AnnouncementSet({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div
      className={`announcement-set flex shrink-0 items-center ${
        duplicate ? "announcement-set-duplicate" : ""
      }`}
      aria-hidden={duplicate || undefined}
    >
      {ANNOUNCEMENTS.map((item) => (
        <span key={item.text} className="flex shrink-0 items-center">
          <Link
            href={item.href}
            tabIndex={duplicate ? -1 : undefined}
            className="whitespace-nowrap px-4 py-1.5 text-[8px] font-medium uppercase leading-none tracking-[0.11em] underline-offset-4 transition-opacity hover:opacity-80 sm:px-5 sm:text-[9px] sm:tracking-[0.13em] lg:px-6 lg:text-[9px]"
          >
            {item.text}
          </Link>
          <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-current opacity-45" aria-hidden="true" />
        </span>
      ))}
    </div>
  );
}

/** Compact, continuously moving promotion ticker above the storefront header. */
export async function AnnouncementBar() {
  const settings = await getSiteSettings();
  if (!settings.announcement.enabled) return null;

  return (
    <div
      className="announcement-viewport overflow-hidden border-b border-white/10 bg-brand text-primary-foreground"
      aria-label="Store announcements"
    >
      <div className="announcement-track flex w-max">
        <AnnouncementSet />
        <AnnouncementSet duplicate />
      </div>
    </div>
  );
}
