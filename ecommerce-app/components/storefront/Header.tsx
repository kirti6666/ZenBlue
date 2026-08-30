import Link from "next/link";
import { Heart } from "lucide-react";
import { connectDB } from "@/lib/db";
import { User as UserModel } from "@/models";
import { getServerUser } from "@/lib/middleware/getServerUser";
import { getSiteSettings } from "@/lib/site-settings";
import { canAccessAdmin } from "@/lib/permissions";
import { Logo } from "./Logo";
import { SearchOverlay } from "./SearchOverlay";
import { CartIcon } from "./CartIcon";
import { AccountMenu } from "./AccountMenu";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

/**
 * Global header.
 *
 * Three-column layout: navigation left, logo centred, actions right — matching
 * the brand's reference design. The centre column is a fixed grid track rather
 * than a flex child, so the logo stays optically centred on the page no matter
 * how many nav items are configured or how wide the icon cluster becomes. A
 * flex layout would let a longer nav shove the mark off-centre.
 *
 * Search is an icon that opens a full-width panel (see SearchOverlay) rather
 * than a bar, precisely so it cannot compete with the logo for that centre
 * space.
 *
 * It is a Server Component so the signed-in state and CMS-driven nav are
 * correct in the first HTML response; only the genuinely interactive parts are
 * client islands. Sticky positioning is CSS, not a scroll listener — it costs
 * nothing at runtime and does not jitter on mobile Safari.
 */
export async function Header() {
  const [user, settings] = await Promise.all([getServerUser(), getSiteSettings()]);
  const { brand, header, commerce } = settings;

  const isStaff = canAccessAdmin(user);
  const accountHref = isStaff ? "/admin" : "/account";

  // Only for the "Hi {name}" line in the account dropdown — cheap, and the
  // header is already a dynamic render because it reads the session cookie.
  let firstName = "";
  if (user && !isStaff) {
    await connectDB();
    const doc = await UserModel.findById(user.id)
      .select("name firstName")
      .lean<{ name?: string; firstName?: string } | null>();
    firstName = doc?.firstName || doc?.name?.split(" ")[0] || "";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-background">
      <div className="relative flex w-full items-center px-3 py-2.5 sm:px-5 xl:grid xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:gap-10 xl:px-10 xl:py-4 2xl:gap-20 2xl:px-12">
        {/* LEFT — navigation on desktop, drawer trigger on mobile */}
        <div className="flex shrink-0 items-center justify-start xl:min-w-0 xl:shrink">
          <MobileNav
            navLinks={header.navLinks}
            isLoggedIn={!!user}
            accountHref={accountHref}
            storeName={brand.storeName}
          />
          <div className="xl:hidden">
            <SearchOverlay currencySymbol={commerce.currencySymbol} />
          </div>
          <div className="hidden min-w-0 xl:block">
            <DesktopNav navLinks={header.navLinks} />
          </div>
        </div>

        {/* CENTRE — the mark */}
        <div className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center xl:static xl:translate-x-0">
          <Logo
            storeName={brand.storeName}
            logoUrl={brand.logoUrl}
            logoDarkUrl={brand.logoDarkUrl}
            palette={settings.theme.palette}
          />
        </div>

        {/* RIGHT — search, account, cart */}
        <div className="ml-auto flex shrink-0 items-center justify-end xl:ml-0 xl:min-w-0">
          <div className="hidden xl:block">
            <SearchOverlay currencySymbol={commerce.currencySymbol} />
          </div>

          <div className="hidden xl:block">
            <AccountMenu name={firstName} isStaff={isStaff} isLoggedIn={!!user} />
          </div>

          <Link
            href={user ? "/account/wishlist" : "/login?callbackUrl=/account/wishlist"}
            aria-label="My wishlist"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-heading transition-colors hover:bg-surface-alt hover:text-link"
          >
            <Heart size={19} strokeWidth={1.6} />
          </Link>

          <CartIcon />
        </div>
      </div>

    </header>
  );
}
