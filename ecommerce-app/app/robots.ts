import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

/** Search-engine crawling rules at the standard /robots.txt URL. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api",
        "/account",
        "/checkout",
        "/cart",
        "/login",
        "/register",
        "/order-success",
        "/track-order",
      ],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
