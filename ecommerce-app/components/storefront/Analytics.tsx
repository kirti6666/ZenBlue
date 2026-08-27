"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

/**
 * Google Analytics 4 + Meta Pixel loader.
 *
 * Both scripts use `afterInteractive` so they never block first paint — the
 * quotation commits to LCP under 2.5s on 4G mobile, and third-party tags are
 * the usual reason that target is missed.
 *
 * Nothing is injected unless the corresponding id is set in Site Settings, so a
 * client who has not signed up for GA4 yet simply ships no tag.
 */

function PageViewTracker({ ga4Id, pixelId }: { ga4Id: string; pixelId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The App Router does soft navigations, which neither tag detects on its
  // own — every route change has to be reported manually.
  useEffect(() => {
    const query = searchParams?.toString();
    const url = pathname + (query ? `?${query}` : "");
    const w = window as any;
    if (ga4Id && typeof w.gtag === "function") {
      w.gtag("config", ga4Id, { page_path: url });
    }
    if (pixelId && typeof w.fbq === "function") {
      w.fbq("track", "PageView");
    }
  }, [pathname, searchParams, ga4Id, pixelId]);

  return null;
}

/**
 * Both ids are interpolated into inline script bodies below. They are validated
 * on write (lib/validations/settings.ts), but a value could still reach the
 * database another way — a direct write, a restored backup, a future migration.
 * Re-checking the shape here means a bad value renders no tag at all rather
 * than executing.
 */
const GA4_PATTERN = /^G-[A-Z0-9]{4,20}$/i;
const PIXEL_PATTERN = /^\d{1,20}$/;

export function Analytics({ ga4Id, pixelId }: { ga4Id: string; pixelId: string }) {
  const safeGa4 = GA4_PATTERN.test(ga4Id ?? "") ? ga4Id : "";
  const safePixel = PIXEL_PATTERN.test(pixelId ?? "") ? pixelId : "";

  if (!safeGa4 && !safePixel) return null;

  return (
    <>
      {safeGa4 && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${safeGa4}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());gtag('config','${safeGa4}',{send_page_view:true});`}
          </Script>
        </>
      )}

      {safePixel && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${safePixel}');fbq('track','PageView');`}
        </Script>
      )}

      <Suspense fallback={null}>
        <PageViewTracker ga4Id={safeGa4} pixelId={safePixel} />
      </Suspense>
    </>
  );
}
