import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@/components/storefront/Analytics";
import { getSiteSettings, resolveTheme } from "@/lib/site-settings";
import { paletteToCssVars } from "@/lib/theme";
import { siteUrl, absoluteUrl, jsonLd } from "@/lib/seo";

/**
 * Self-hosted via next/font so there is no render-blocking request to Google
 * and no layout shift — both count against the quotation's LCP-under-2.5s
 * commitment on 4G mobile.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans-loaded",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-display-loaded",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16233B",
};

/**
 * Metadata is generated from the admin-editable Site Settings, so the client
 * can change titles, descriptions, the favicon and search-console verification
 * without a redeploy. Open Graph and Twitter cards are included here so every
 * page inherits a correct social preview unless it overrides them.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = settings.seo.metaTitle || settings.brand.storeName;
  const description = settings.seo.metaDescription;
  const socialImage = settings.home.heroSlides[0]?.image || settings.home.hero.backgroundImage;

  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: title,
      // Inner pages set just their own name; this appends the brand.
      template: `%s · ${settings.brand.storeName}`,
    },
    description,
    applicationName: settings.brand.storeName,
    category: "fashion",
    keywords: [
      "ZenBlue",
      "premium menswear",
      "men's clothing India",
      "men's T-shirts",
      "men's shirts",
      "polo T-shirts",
      "Ahmedabad clothing brand",
    ],
    icons: settings.brand.faviconUrl ? { icon: settings.brand.faviconUrl } : undefined,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: settings.brand.storeName,
      title,
      description,
      url: siteUrl(),
      locale: "en_IN",
      images: socialImage ? [{ url: socialImage, alt: settings.brand.storeName }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: socialImage ? [socialImage] : undefined,
    },
    verification: settings.integrations.googleSiteVerification
      ? { google: settings.integrations.googleSiteVerification }
      : undefined,
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  // The chosen ZenBlue colour direction, emitted as CSS custom properties.
  // Tailwind's colour scale resolves to these (see tailwind.config.ts), so a
  // palette switch in the admin re-skins the whole site with no rebuild.
  const themeVars = paletteToCssVars(resolveTheme(settings));

  // Organization JSON-LD, site-wide. Product/Breadcrumb/FAQ schema is emitted
  // by the pages that own that content.
  const orgSchema = {
    "@type": "OnlineStore",
    name: settings.brand.storeName,
    url: siteUrl(),
    description: settings.seo.metaDescription,
    ...(settings.brand.logoUrl ? { logo: absoluteUrl(settings.brand.logoUrl) } : {}),
    ...(settings.contact.phone || settings.contact.email
      ? {
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              ...(settings.contact.phone ? { telephone: settings.contact.phone } : {}),
              ...(settings.contact.supportEmail || settings.contact.email
                ? { email: settings.contact.supportEmail || settings.contact.email }
                : {}),
              areaServed: "IN",
              availableLanguage: ["en", "hi"],
            },
          ],
        }
      : {}),
    sameAs: [
      settings.social.instagram,
      settings.social.facebook,
      settings.social.twitter,
      settings.social.youtube,
    ].filter(Boolean),
  };

  const websiteSchema = {
    "@type": "WebSite",
    name: settings.brand.storeName,
    url: siteUrl(),
    inLanguage: "en-IN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl()}/shop?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const schemaGraph = { "@context": "https://schema.org", "@graph": [orgSchema, websiteSchema] };

  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
        <style
          dangerouslySetInnerHTML={{
            __html: `:root{--font-sans:${inter.style.fontFamily};--font-display:${cormorant.style.fontFamily};}`,
          }}
        />
        <Script
          id="org-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(schemaGraph) }}
        />
      </head>
      <body className="flex flex-col min-h-screen bg-background text-body">
        <Providers>{children}</Providers>
        {/* GA4 + Meta Pixel — only injected once the ids are set in settings. */}
        <Analytics
          ga4Id={settings.integrations.ga4MeasurementId}
          pixelId={settings.integrations.metaPixelId}
        />
      </body>
    </html>
  );
}
