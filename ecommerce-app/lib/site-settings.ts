import { connectDB } from "@/lib/db";
import { SiteSettings } from "@/models";
import { getPalette, type PaletteTokens } from "@/lib/theme";
import { DEFAULT_MEGA_MENU_IMAGES } from "@/lib/site-settings-constants";
import { RETURN_WINDOW_DAYS } from "@/lib/return-policy";
import { cache } from "react";
export { MAX_HERO_SLIDES, DEFAULT_MEGA_MENU_IMAGES } from "@/lib/site-settings-constants";

/**
 * Shared TypeScript shape for the CMS settings. This is the single source of
 * truth the admin form, the API, and every storefront component agree on.
 */
export interface NavLink {
  label: string;
  href: string;
  /** Optional dropdown, used by the header's "Categories" item. */
  children?: NavLink[];
  /** Three promotional cards displayed beside the mega-menu link list. */
  promoImages?: string[];
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}
export interface Highlight {
  icon: string;
  title: string;
  subtitle: string;
}
export interface Banner {
  /** Wide artwork used on desktop screens. */
  image: string;
  /** Square artwork used on mobile and tablet screens. */
  mobileImage?: string;
  /** Optional background video; `image` acts as its poster frame. */
  videoUrl?: string;
  heading: string;
  subheading: string;
  link: string;
}
export interface Testimonial {
  quote: string;
  author: string;
  location: string;
  rating: number;
  avatar: string;
}
export interface InstagramPost {
  image: string;
  link: string;
  caption: string;
}
export interface ReelVideo {
  videoUrl: string;
  poster: string;
  title: string;
  link: string;
}
export interface SizeChart {
  key: string;
  title: string;
  unitNote: string;
  columns: string[];
  rows: string[][];
}
export interface ChannelToggle {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
}

/**
 * Ceiling on the homepage hero rotation.
 *
 * Lives here rather than in the slider so the admin form can enforce the same
 * number without pulling a client component into the settings bundle. Fifteen
 * is a product decision, not a technical limit: past that the last slides are
 * effectively never seen, since a visitor rarely stays on the homepage long
 * enough for the carousel to reach them.
 */
export interface SiteSettingsData {
  brand: {
    storeName: string;
    tagline: string;
    /** Logo for LIGHT grounds (directions B and D). */
    logoUrl: string;
    /** Reversed logo for DARK grounds (directions A and C); falls back to logoUrl. */
    logoDarkUrl: string;
    faviconUrl: string;
  };
  seo: { metaTitle: string; metaDescription: string };
  theme: { palette: string; primaryColor: string; primaryForeground: string };
  commerce: {
    currencySymbol: string;
    currencyCode: string;
    shippingFee: number;
    freeShippingThreshold: number;
    codEnabled: boolean;
    razorpayEnabled: boolean;
  };
  announcement: { enabled: boolean; text: string; link: string };
  home: {
    /** At most MAX_HERO_SLIDES entries; both the admin form and the slider cap it. */
    heroSlides: Banner[];
    hero: {
      title: string;
      subtitle: string;
      ctaText: string;
      ctaLink: string;
      backgroundImage: string;
      mobileBackgroundImage: string;
    };
    categoriesHeading: string;
    featuredHeading: string;
    newArrivalsHeading: string;
    bestSellersHeading: string;
    testimonialsHeading: string;
    instagramHeading: string;
    showNewArrivals: boolean;
    showBestSellers: boolean;
    highlights: Highlight[];
    banners: Banner[];
    testimonials: Testimonial[];
  };
  header: { navLinks: NavLink[] };
  footer: { about: string; columns: FooterColumn[]; copyrightText: string };
  contact: {
    email: string;
    supportEmail: string;
    phone: string;
    whatsapp: string;
    address: string;
    businessHours: string;
  };
  social: {
    facebook: string;
    instagram: string;
    twitter: string;
    youtube: string;
    linkedin: string;
    pinterest: string;
  };
  integrations: {
    ga4MeasurementId: string;
    metaPixelId: string;
    googleSiteVerification: string;
    whatsappNumber: string;
    whatsappPrefillMessage: string;
    whatsappCatalogUrl: string;
    mapEmbedUrl: string;
    instagramHandle: string;
    instagramPosts: InstagramPost[];
    /** Portrait videos shown in the homepage Shop the Look rail; max 5. */
    reelVideos: ReelVideo[];
  };
  notifications: {
    orderPlaced: ChannelToggle;
    paymentConfirmed: ChannelToggle;
    orderConfirmed: ChannelToggle;
    orderShipped: ChannelToggle;
    outForDelivery: ChannelToggle;
    orderDelivered: ChannelToggle;
    orderCancelled: ChannelToggle;
    returnUpdate: ChannelToggle;
    refundIssued: ChannelToggle;
    abandonedCart: ChannelToggle;
    backInStock: ChannelToggle;
  };
  returns: {
    enabled: boolean;
    windowDays: number;
    exchangeEnabled: boolean;
    storeCreditEnabled: boolean;
    storeCreditBonusPercent: number;
    policySummary: string;
  };
  abandonedCart: {
    enabled: boolean;
    abandonAfterMinutes: number;
    step1AfterHours: number;
    step2AfterHours: number;
    step3AfterHours: number;
    incentiveCouponCode: string;
    incentiveFromStep: number;
    recoveryLinkExpiryHours: number;
  };
  shipping: {
    provider: "manual" | "shiprocket" | "delhivery";
    pickupPincode: string;
    pickupLocationName: string;
    defaultWeightKg: number;
    defaultLengthCm: number;
    defaultBreadthCm: number;
    defaultHeightCm: number;
    codEnabled: boolean;
    codExtraFee: number;
    estimatedDeliveryDays: string;
  };
  newsletter: {
    enabled: boolean;
    heading: string;
    subtext: string;
    buttonText: string;
    successMessage: string;
  };
  sizeCharts: SizeChart[];
}

const allChannels = (email = true, whatsapp = false, sms = false): ChannelToggle => ({
  email,
  whatsapp,
  sms,
});

/**
 * The fallback content used when the DB has no settings yet (fresh install),
 * or when a stored doc is missing a newly-added field. These defaults are the
 * ZenBlue launch content, so a fresh deploy already reads as the real store
 * rather than as a demo.
 */
export const DEFAULT_SETTINGS: SiteSettingsData = {
  brand: {
    storeName: "ZEN BLUE",
    tagline: "Minimal by design. Distinct by identity.",
    // Ship the bundled wordmarks so the header is branded before anything is
    // uploaded. Replace either at Admin → Settings → Branding.
    logoUrl: "/branding/zenblue-logo-ivory.png",
    logoDarkUrl: "/brand/zenblue-logo-dark.svg",
    faviconUrl: "/brand/favicon.svg",
  },
  seo: {
    metaTitle: "ZEN BLUE — Premium Menswear",
    metaDescription:
      "ZEN BLUE is a modern menswear brand focused on premium, versatile and minimal clothing designed for the contemporary man.",
  },
  theme: {
    // Direction B (Ivory & Navy) — the selected colour direction.
    palette: "B",
    primaryColor: "",
    primaryForeground: "",
  },
  commerce: {
    currencySymbol: "₹",
    currencyCode: "INR",
    shippingFee: 0,
    freeShippingThreshold: 0,
    codEnabled: true,
    razorpayEnabled: true,
  },
  announcement: {
    enabled: true,
    text: "Free shipping on all orders",
    link: "/shop",
  },
  home: {
    // One finished campaign banner is used responsively on every device.
    heroSlides: [
      {
        image: "/banners/men-women-desktop-hero.png",
        mobileImage: "/banners/men-women-mobile-tablet-hero.png",
        videoUrl: "",
        heading: "",
        subheading: "",
        link: "/category/polos",
      },
    ],
    hero: {
      title: "Timeless Style. Modern Man.",
      subtitle:
        "Thoughtfully designed menswear for every moment. Crafted with detail. Worn with confidence.",
      ctaText: "Explore collection",
      ctaLink: "/shop",
      backgroundImage: "",
      mobileBackgroundImage: "",
    },
    categoriesHeading: "Shop by Category",
    featuredHeading: "Featured",
    newArrivalsHeading: "New Arrivals",
    bestSellersHeading: "Best Sellers",
    testimonialsHeading: "What our customers say",
    instagramHeading: "@zenblue on Instagram",
    showNewArrivals: true,
    showBestSellers: true,
    highlights: [
      { icon: "Package", title: "Free shipping", subtitle: "On every order" },
      { icon: "RotateCcw", title: "Easy returns", subtitle: "Hassle free returns" },
      { icon: "ShieldCheck", title: "Secure payments", subtitle: "100% secure & trusted" },
      { icon: "Headphones", title: "Customer support", subtitle: "We are here to help you" },
    ],
    banners: [],
    testimonials: [
      {
        quote:
          "The fabric weight is exactly what the site promised. Third order this year and the first tee still looks new.",
        author: "Rohan M.",
        location: "Bengaluru",
        rating: 5,
        avatar: "",
      },
      {
        quote: "Sizing guide was spot on, and the reverse pickup for my exchange took one day.",
        author: "Aditya S.",
        location: "Pune",
        rating: 5,
        avatar: "",
      },
      {
        quote: "Finally a polo that keeps its collar. Worth every rupee.",
        author: "Kabir N.",
        location: "Delhi",
        rating: 5,
        avatar: "",
      },
    ],
  },
  header: {
    // Kept short: with the logo occupying the centre track, a long nav pushes
    // the left column wide and unbalances the header. Everything else lives in
    // the footer. Editable at Settings → Navigation.
    navLinks: [
      {
        label: "SHIRTS",
        href: "/category/shirts",
        promoImages: [...DEFAULT_MEGA_MENU_IMAGES],
        children: [
          { label: "All Shirts", href: "/category/shirts" },
          { label: "Plain Shirts", href: "/category/shirts" },
          { label: "Printed Shirts", href: "/category/shirts" },
          { label: "Checked Shirts", href: "/category/shirts" },
          { label: "Striped Shirts", href: "/category/shirts" },
          { label: "Double Pocket Shirts", href: "/category/shirts" },
          { label: "Oversized Shirts", href: "/category/shirts" },
        ],
      },
      {
        label: "T SHIRTS",
        href: "/category/t-shirts",
        promoImages: [...DEFAULT_MEGA_MENU_IMAGES],
        children: [
          { label: "All T-Shirts", href: "/category/t-shirts" },
          { label: "Cotton T-Shirts", href: "/category/t-shirts" },
          { label: "Oversized T-Shirts", href: "/category/streetwear" },
          { label: "Polo T-Shirts", href: "/category/polos" },
          { label: "Zipper Polos", href: "/category/polos" },
          { label: "Plus Size", href: "/category/t-shirts" },
        ],
      },
      {
        label: "COMBO",
        href: "/category/combo",
        promoImages: [...DEFAULT_MEGA_MENU_IMAGES],
        children: [
          { label: "All Combos", href: "/category/combo" },
          { label: "T-Shirt Combos", href: "/category/combo" },
          { label: "Shirt Combos", href: "/category/combo" },
          { label: "Corporate Packs", href: "/bulk-orders" },
        ],
      },
      {
        label: "SHOP ALL",
        href: "/shop",
        promoImages: [...DEFAULT_MEGA_MENU_IMAGES],
        children: [
          { label: "All Products", href: "/shop" },
          { label: "New Arrivals", href: "/new-arrivals" },
          { label: "Best Sellers", href: "/shop?sort=popular" },
          { label: "Sale", href: "/shop?sort=price-asc" },
        ],
      },
      {
        label: "BULK ORDERS",
        href: "/bulk-orders",
        promoImages: [...DEFAULT_MEGA_MENU_IMAGES],
        children: [
          { label: "Corporate Orders", href: "/bulk-orders" },
          { label: "Team Uniforms", href: "/bulk-orders" },
          { label: "Event Orders", href: "/bulk-orders" },
          { label: "Request a Quote", href: "/bulk-orders" },
        ],
      },
      {
        label: "CUSTOMIZATION",
        href: "/customization",
        promoImages: [...DEFAULT_MEGA_MENU_IMAGES],
        children: [
          { label: "Custom T-Shirts", href: "/customization" },
          { label: "Custom Shirts", href: "/customization" },
          { label: "Embroidery", href: "/customization" },
          { label: "Bulk Customization", href: "/customization" },
        ],
      },
    ],
  },
  footer: {
    about:
      "Minimal by design. Premium by choice.",
    columns: [
      {
        title: "Shop",
        links: [
          { label: "New In", href: "/new-arrivals" },
          { label: "Shop All", href: "/shop" },
          { label: "Sale", href: "/shop?sort=popular" },
        ],
      },
      {
        title: "Collections",
        links: [
          { label: "T-Shirts", href: "/category/t-shirts" },
          { label: "Polos", href: "/category/polos" },
          { label: "Streetwear", href: "/category/streetwear" },
          { label: "Accessories", href: "/category/accessories" },
        ],
      },
      {
        title: "Customer Care",
        links: [
          { label: "Track Order", href: "/track-order" },
          { label: "Returns & Exchanges", href: "/pages/return-exchange-policy" },
          { label: "Shipping Policy", href: "/pages/shipping-policy" },
          { label: "FAQs", href: "/faq" },
          { label: "About Us", href: "/about" },
          { label: "Bulk & Corporate Orders", href: "/bulk-orders" },
          { label: "Customization", href: "/customization" },
          { label: "Contact Us", href: "/contact" },
        ],
      },
    ],
    copyrightText: "© {year} ZEN BLUE. All rights reserved.",
  },
  contact: {
    email: "zenblueclothing@gmail.com",
    supportEmail: "support@zenblue.in",
    phone: "+91 74878 59546",
    whatsapp: "917487859546",
    address: "",
    businessHours: "Mon–Sat, 10:00 – 19:00 IST",
  },
  social: { facebook: "", instagram: "", twitter: "", youtube: "", linkedin: "", pinterest: "" },
  integrations: {
    ga4MeasurementId: "",
    metaPixelId: "",
    googleSiteVerification: "",
    whatsappNumber: "917487859546",
    whatsappPrefillMessage: "Hi ZEN BLUE, I have a question about",
    whatsappCatalogUrl: "",
    mapEmbedUrl: "",
    instagramHandle: "zenblue",
    instagramPosts: [],
    reelVideos: [
      { videoUrl: "/reels/zenblue-reel-1.mp4", poster: "", title: "ZenBlue look 01", link: "/shop" },
      { videoUrl: "/reels/zenblue-reel-2.mp4", poster: "", title: "ZenBlue look 02", link: "/shop" },
      { videoUrl: "/reels/zenblue-reel-3.mp4", poster: "", title: "ZenBlue look 03", link: "/shop" },
    ],
  },
  notifications: {
    orderPlaced: allChannels(),
    paymentConfirmed: allChannels(),
    orderConfirmed: allChannels(),
    orderShipped: allChannels(),
    outForDelivery: allChannels(false),
    orderDelivered: allChannels(),
    orderCancelled: allChannels(),
    returnUpdate: allChannels(),
    refundIssued: allChannels(),
    abandonedCart: allChannels(),
    backInStock: allChannels(),
  },
  returns: {
    enabled: true,
    windowDays: RETURN_WINDOW_DAYS,
    exchangeEnabled: true,
    storeCreditEnabled: true,
    storeCreditBonusPercent: 0,
    policySummary:
      "Unworn, unwashed items with original tags are eligible for return or exchange. Reverse pickup is free.",
  },
  abandonedCart: {
    enabled: true,
    abandonAfterMinutes: 60,
    step1AfterHours: 1,
    step2AfterHours: 24,
    step3AfterHours: 72,
    incentiveCouponCode: "",
    incentiveFromStep: 3,
    recoveryLinkExpiryHours: 168,
  },
  shipping: {
    provider: "manual",
    pickupPincode: "",
    pickupLocationName: "Primary",
    defaultWeightKg: 0.3,
    defaultLengthCm: 30,
    defaultBreadthCm: 24,
    defaultHeightCm: 4,
    codEnabled: true,
    codExtraFee: 0,
    estimatedDeliveryDays: "3-6 business days",
  },
  newsletter: {
    enabled: true,
    heading: "Newsletter",
    subtext: "Subscribe for updates and exclusive offers.",
    buttonText: "Subscribe",
    successMessage: "You are on the list.",
  },
  sizeCharts: [
    {
      key: "tshirt",
      title: "T-Shirt Size Guide",
      unitNote: "All measurements in inches. Garment measured flat.",
      columns: ["Size", "Chest", "Length", "Shoulder", "Sleeve"],
      rows: [
        ["S", "38", "27", "16.5", "8"],
        ["M", "40", "28", "17.5", "8.5"],
        ["L", "42", "29", "18.5", "9"],
        ["XL", "44", "30", "19.5", "9.5"],
        ["XXL", "46", "31", "20.5", "10"],
      ],
    },
    {
      key: "polo",
      title: "Polo Size Guide",
      unitNote: "All measurements in inches. Garment measured flat.",
      columns: ["Size", "Chest", "Length", "Shoulder"],
      rows: [
        ["S", "39", "27.5", "17"],
        ["M", "41", "28.5", "18"],
        ["L", "43", "29.5", "19"],
        ["XL", "45", "30.5", "20"],
        ["XXL", "47", "31.5", "21"],
      ],
    },
  ],
};

/** True for plain `{}` objects — used to decide what to deep-merge vs. copy. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge `stored` over `defaults`. Objects merge key-by-key; arrays and
 * scalars from `stored` replace the default entirely (so an admin who clears
 * all nav links really gets zero nav links, not the defaults back).
 */
export function mergeSettings<T>(defaults: T, stored: unknown): T {
  if (!isPlainObject(defaults) || !isPlainObject(stored)) return defaults;
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };

  for (const key of Object.keys(defaults as Record<string, unknown>)) {
    const dVal = (defaults as Record<string, unknown>)[key];
    const sVal = stored[key];
    if (sVal === undefined || sVal === null) {
      out[key] = dVal;
    } else if (isPlainObject(dVal) && isPlainObject(sVal)) {
      out[key] = mergeSettings(dVal, sVal);
    } else {
      out[key] = sVal;
    }
  }
  return out as T;
}

/**
 * Reads the singleton settings doc, creating it with defaults on first call,
 * and always returns a plain, fully-populated SiteSettingsData object (defaults
 * merged under whatever is stored). Safe to call from any Server Component,
 * layout, or route handler.
 */
async function readSiteSettings(): Promise<SiteSettingsData> {
  try {
    await connectDB();
    let doc = await SiteSettings.findOne({ singletonKey: "site" }).lean();
    if (!doc) {
      const created = await SiteSettings.create({ singletonKey: "site", ...DEFAULT_SETTINGS });
      doc = created.toObject();
    }
    const settings = mergeSettings(DEFAULT_SETTINGS, doc as unknown);
    // The store's customer policy is a fixed seven-day window. Normalize old
    // documents so a stale admin value can never leave the UI and API at odds.
    if (settings.returns.windowDays !== RETURN_WINDOW_DAYS) {
      settings.returns.windowDays = RETURN_WINDOW_DAYS;
      await SiteSettings.updateOne(
        { singletonKey: "site", "returns.windowDays": { $ne: RETURN_WINDOW_DAYS } },
        { $set: { "returns.windowDays": RETURN_WINDOW_DAYS } }
      );
    }
    // Return-policy copy belongs on product, order and policy screens, not in
    // the announcement ribbon. Clean up older seeded/admin values once.
    if (/returns?/i.test(settings.announcement.text)) {
      const previousAnnouncement = settings.announcement.text;
      settings.announcement.text = DEFAULT_SETTINGS.announcement.text;
      await SiteSettings.updateOne(
        { singletonKey: "site", "announcement.text": previousAnnouncement },
        { $set: { "announcement.text": DEFAULT_SETTINGS.announcement.text } }
      );
    }
    // Shipping is free store-wide. Normalize legacy threshold/fee settings so
    // the public settings API and admin screen cannot suggest otherwise.
    if (settings.commerce.shippingFee !== 0 || settings.commerce.freeShippingThreshold !== 0) {
      settings.commerce.shippingFee = 0;
      settings.commerce.freeShippingThreshold = 0;
      await SiteSettings.updateOne(
        { singletonKey: "site" },
        { $set: { "commerce.shippingFee": 0, "commerce.freeShippingThreshold": 0 } }
      );
    }
    if (/over\s*₹?\s*[\d,]+/i.test(settings.announcement.text)) {
      settings.announcement.text = DEFAULT_SETTINGS.announcement.text;
      await SiteSettings.updateOne(
        { singletonKey: "site" },
        { $set: { "announcement.text": DEFAULT_SETTINGS.announcement.text } }
      );
    }
    // Migrate the original seed inbox to the dedicated customer-support
    // address. Admin-entered custom addresses are left untouched.
    if (settings.contact.supportEmail === "zenblueclothing@gmail.com") {
      settings.contact.supportEmail = "support@zenblue.in";
      await SiteSettings.updateOne(
        { singletonKey: "site", "contact.supportEmail": "zenblueclothing@gmail.com" },
        { $set: { "contact.supportEmail": "support@zenblue.in" } }
      );
    }
    return settings;
  } catch (err) {
    // Never let a settings/DB hiccup take down a page — fall back to defaults.
    console.error("getSiteSettings failed, using defaults:", err);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Header, footer, announcement, floating actions and the page itself all read
 * the same settings during one render. React's request cache turns those five
 * identical database reads into one while still returning fresh settings on
 * the next request (so admin edits remain immediate).
 */
export const getSiteSettings = cache(readSiteSettings);

/**
 * Resolves the live colour tokens: the chosen ZenBlue direction, with the two
 * optional per-site overrides applied on top when the admin has set them.
 */
export function resolveTheme(settings: SiteSettingsData): PaletteTokens {
  const base = getPalette(settings.theme.palette);
  return {
    ...base,
    primary: settings.theme.primaryColor?.trim() || base.primary,
    primaryForeground: settings.theme.primaryForeground?.trim() || base.primaryForeground,
  };
}

/** Format a numeric amount with the configured currency symbol, e.g. "₹1,499". */
export function formatPrice(amount: number, symbol = "₹"): string {
  const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;
  return `${symbol}${rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Look up a size chart by the key stored on a product. */
export function findSizeChart(settings: SiteSettingsData, key?: string): SizeChart | null {
  if (!key) return null;
  return settings.sizeCharts.find((c) => c.key === key) ?? null;
}

/** Build a click-to-chat WhatsApp URL from the configured business number. */
export function whatsappLink(settings: SiteSettingsData, message?: string): string {
  const num = settings.integrations.whatsappNumber.replace(/\D/g, "");
  if (!num) return "";
  const text = encodeURIComponent(message || settings.integrations.whatsappPrefillMessage || "");
  return `https://wa.me/${num}${text ? `?text=${text}` : ""}`;
}
