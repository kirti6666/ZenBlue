import { AnnouncementBar } from "@/components/storefront/AnnouncementBar";
import { CartSync } from "@/components/storefront/CartSync";
import { Footer } from "@/components/storefront/Footer";
import { Header } from "@/components/storefront/Header";
import { WhatsAppFloat } from "@/components/storefront/WhatsAppFloat";
import { SmoothScroll } from "@/components/storefront/SmoothScroll";

/**
 * Storefront-only chrome.
 *
 * Keeping this inside the storefront route group prevents the customer
 * navigation, footer and floating actions from appearing in the independent
 * full-screen admin workspace.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SmoothScroll />
      <AnnouncementBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppFloat />
      {/* Snapshots the client cart server-side for abandoned-cart recovery. */}
      <CartSync />
    </div>
  );
}
