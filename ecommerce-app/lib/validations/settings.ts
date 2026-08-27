import { z } from "zod";
import { MAX_HERO_SLIDES } from "@/lib/site-settings-constants";

/**
 * Validates the full settings object sent by the admin form. Every field has a
 * default so a partial payload still parses cleanly — the form always posts the
 * whole object, but being lenient keeps the API robust against version drift.
 */

const linkSchema = z.object({
  label: z.string().default(""),
  href: z.string().default(""),
});

const navLinkSchema = linkSchema.extend({
  children: z.array(linkSchema).default([]),
  promoImages: z.array(z.string()).max(3).default([]),
});

const footerColumnSchema = z.object({
  title: z.string().default(""),
  links: z.array(linkSchema).default([]),
});

const highlightSchema = z.object({
  icon: z.string().default(""),
  title: z.string().default(""),
  subtitle: z.string().default(""),
});

const bannerSchema = z.object({
  image: z.string().default(""),
  mobileImage: z.string().default(""),
  videoUrl: z.string().default(""),
  heading: z.string().default(""),
  subheading: z.string().default(""),
  link: z.string().default(""),
});

const testimonialSchema = z.object({
  quote: z.string().default(""),
  author: z.string().default(""),
  location: z.string().default(""),
  rating: z.coerce.number().min(1).max(5).default(5),
  avatar: z.string().default(""),
});

const instagramPostSchema = z.object({
  image: z.string().default(""),
  link: z.string().default(""),
  caption: z.string().default(""),
});

const reelVideoSchema = z.object({
  videoUrl: z.string().default(""),
  poster: z.string().default(""),
  title: z.string().default(""),
  link: z.string().default("/shop"),
});

const sizeChartSchema = z.object({
  key: z.string().default(""),
  title: z.string().default(""),
  unitNote: z.string().default(""),
  columns: z.array(z.string()).default([]),
  rows: z.array(z.array(z.string())).default([]),
});

/** Per-event channel switches; every event shares this shape. */
const channelToggleSchema = z
  .object({
    email: z.boolean().default(true),
    whatsapp: z.boolean().default(false),
    sms: z.boolean().default(false),
  })
  .default({});

export const settingsSchema = z.object({
  brand: z
    .object({
      storeName: z.string().trim().min(1, "Store name is required").default("Store"),
      tagline: z.string().default(""),
      logoUrl: z.string().default(""),
      logoDarkUrl: z.string().default(""),
      faviconUrl: z.string().default(""),
    })
    .default({}),
  seo: z
    .object({
      metaTitle: z.string().default("E-Commerce Store"),
      metaDescription: z.string().default(""),
    })
    .default({}),
  theme: z
    .object({
      // Which ZenBlue colour direction is live. Anything outside A-D would
      // silently fall back to the default at render time, so it is rejected
      // here instead.
      palette: z.enum(["A", "B", "C", "D"]).default("B"),
      // Blank means "use the palette's own value" — see resolveTheme().
      primaryColor: z.string().default(""),
      primaryForeground: z.string().default(""),
    })
    .default({}),
  commerce: z
    .object({
      currencySymbol: z.string().default("₹"),
      currencyCode: z.string().default("INR"),
      shippingFee: z.coerce.number().min(0).default(49),
      freeShippingThreshold: z.coerce.number().min(0).default(999),
      codEnabled: z.boolean().default(true),
      razorpayEnabled: z.boolean().default(true),
    })
    .default({}),
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().default(""),
      link: z.string().default(""),
    })
    .default({}),
  home: z
    .object({
      hero: z
        .object({
          title: z.string().default(""),
          subtitle: z.string().default(""),
          ctaText: z.string().default(""),
          ctaLink: z.string().default(""),
          backgroundImage: z.string().default(""),
          mobileBackgroundImage: z.string().default(""),
        })
        .default({}),
      // Capped server-side as well as in the form: the settings PUT is a
      // plain JSON endpoint, so the admin UI's limit is not an enforcement
      // point.
      heroSlides: z.array(bannerSchema).max(MAX_HERO_SLIDES).default([]),
      categoriesHeading: z.string().default("Shop by Category"),
      featuredHeading: z.string().default("Featured"),
      newArrivalsHeading: z.string().default("New Arrivals"),
      bestSellersHeading: z.string().default("Best Sellers"),
      testimonialsHeading: z.string().default("What our customers say"),
      instagramHeading: z.string().default("On Instagram"),
      showNewArrivals: z.boolean().default(true),
      showBestSellers: z.boolean().default(true),
      highlights: z.array(highlightSchema).default([]),
      banners: z.array(bannerSchema).default([]),
      testimonials: z.array(testimonialSchema).default([]),
    })
    .default({}),
  header: z
    .object({
      navLinks: z.array(navLinkSchema).default([]),
    })
    .default({}),
  footer: z
    .object({
      about: z.string().default(""),
      columns: z.array(footerColumnSchema).default([]),
      copyrightText: z.string().default(""),
    })
    .default({}),
  contact: z
    .object({
      email: z.string().default(""),
      supportEmail: z.string().default(""),
      phone: z.string().default(""),
      whatsapp: z.string().default(""),
      address: z.string().default(""),
      businessHours: z.string().default(""),
    })
    .default({}),
  social: z
    .object({
      facebook: z.string().default(""),
      instagram: z.string().default(""),
      twitter: z.string().default(""),
      youtube: z.string().default(""),
      linkedin: z.string().default(""),
      pinterest: z.string().default(""),
    })
    .default({}),
  integrations: z
    .object({
      // Public ids only — API secrets belong in environment variables, never
      // in a document the admin form round-trips through the browser.
      //
      // These three are interpolated into INLINE <script> bodies by
      // components/storefront/Analytics.tsx, so their character set is
      // constrained here rather than merely trusted. An unconstrained string
      // would let anyone who can write settings inject arbitrary JavaScript
      // into every page of the storefront.
      ga4MeasurementId: z
        .string()
        .regex(/^(G-[A-Z0-9]{4,20})?$/i, "Enter a GA4 ID like G-XXXXXXXXXX")
        .default(""),
      metaPixelId: z
        .string()
        .regex(/^\d{0,20}$/, "A Meta Pixel ID is numeric")
        .default(""),
      googleSiteVerification: z
        .string()
        .regex(/^[A-Za-z0-9_-]{0,128}$/, "Enter the verification token only")
        .default(""),
      whatsappNumber: z.string().default(""),
      whatsappPrefillMessage: z.string().default(""),
      whatsappCatalogUrl: z.string().default(""),
      mapEmbedUrl: z.string().default(""),
      instagramHandle: z.string().default(""),
      instagramPosts: z.array(instagramPostSchema).default([]),
      reelVideos: z.array(reelVideoSchema).max(5).default([]),
    })
    .default({}),
  notifications: z
    .object({
      orderPlaced: channelToggleSchema,
      paymentConfirmed: channelToggleSchema,
      orderConfirmed: channelToggleSchema,
      orderShipped: channelToggleSchema,
      outForDelivery: channelToggleSchema,
      orderDelivered: channelToggleSchema,
      orderCancelled: channelToggleSchema,
      returnUpdate: channelToggleSchema,
      refundIssued: channelToggleSchema,
      abandonedCart: channelToggleSchema,
      backInStock: channelToggleSchema,
    })
    .default({}),
  returns: z
    .object({
      enabled: z.boolean().default(true),
      windowDays: z.coerce.number().int().min(0).max(365).default(7),
      exchangeEnabled: z.boolean().default(true),
      storeCreditEnabled: z.boolean().default(true),
      storeCreditBonusPercent: z.coerce.number().min(0).max(100).default(0),
      policySummary: z.string().default(""),
    })
    .default({}),
  abandonedCart: z
    .object({
      enabled: z.boolean().default(true),
      abandonAfterMinutes: z.coerce.number().int().min(5).default(60),
      step1AfterHours: z.coerce.number().min(0).default(1),
      step2AfterHours: z.coerce.number().min(0).default(24),
      step3AfterHours: z.coerce.number().min(0).default(72),
      incentiveCouponCode: z.string().default(""),
      incentiveFromStep: z.coerce.number().int().min(1).max(3).default(3),
      recoveryLinkExpiryHours: z.coerce.number().min(1).default(168),
    })
    .default({}),
  shipping: z
    .object({
      provider: z.enum(["manual", "shiprocket", "delhivery"]).default("manual"),
      pickupPincode: z.string().default(""),
      pickupLocationName: z.string().default("Primary"),
      defaultWeightKg: z.coerce.number().min(0.01).default(0.3),
      defaultLengthCm: z.coerce.number().min(0).default(30),
      defaultBreadthCm: z.coerce.number().min(0).default(24),
      defaultHeightCm: z.coerce.number().min(0).default(4),
      codEnabled: z.boolean().default(true),
      codExtraFee: z.coerce.number().min(0).default(0),
      estimatedDeliveryDays: z.string().default("3-6 business days"),
    })
    .default({}),
  newsletter: z
    .object({
      enabled: z.boolean().default(true),
      heading: z.string().default(""),
      subtext: z.string().default(""),
      buttonText: z.string().default("Subscribe"),
      successMessage: z.string().default(""),
    })
    .default({}),
  sizeCharts: z.array(sizeChartSchema).default([]),
});

export type SettingsInput = z.infer<typeof settingsSchema>;
