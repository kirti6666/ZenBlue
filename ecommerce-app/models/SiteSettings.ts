import { Schema, models, model } from "mongoose";

/**
 * SiteSettings — a SINGLETON document that holds every piece of site-wide,
 * admin-editable content/config for the storefront. There is only ever ONE
 * of these (identified by `singletonKey: "site"`), so the whole CMS is just
 * "read this one doc, edit this one doc".
 *
 * Design choices:
 *  - Grouped into logical sections (brand, seo, theme, commerce, home, ...)
 *    so the admin form can render one tab per section.
 *  - Sub-documents use `_id: false` — these are plain config blobs, not
 *    separately-addressable records, so they don't need their own ids.
 *  - Nothing here is "required": getSiteSettings() always merges the stored
 *    doc over DEFAULT_SETTINGS, so a missing field can never break a page.
 */

// ---- Sub-schemas (repeatable list items) -------------------------------

const LinkSchema = new Schema(
  {
    label: { type: String, default: "" },
    href: { type: String, default: "" },
  },
  { _id: false }
);

// Header links support one submenu level. Footer links intentionally stay
// flat, so their simpler schema is retained separately.
const HeaderLinkSchema = new Schema(
  {
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    children: { type: [LinkSchema], default: [] },
    promoImages: { type: [String], default: [] },
  },
  { _id: false }
);

const FooterColumnSchema = new Schema(
  {
    title: { type: String, default: "" },
    links: { type: [LinkSchema], default: [] },
  },
  { _id: false }
);

const HighlightSchema = new Schema(
  {
    icon: { type: String, default: "" }, // lucide icon name, e.g. "Truck"
    title: { type: String, default: "" },
    subtitle: { type: String, default: "" },
  },
  { _id: false }
);

const BannerSchema = new Schema(
  {
    /** Background still. Also the poster frame when `videoUrl` is set. */
    image: { type: String, default: "" },
    /** Square mobile/tablet alternative to the wide desktop still. */
    mobileImage: { type: String, default: "" },
    /**
     * Optional background video. When present it plays muted and looped behind
     * the copy, with `image` shown until it can play — so a slow connection
     * never leaves the hero blank.
     */
    videoUrl: { type: String, default: "" },
    heading: { type: String, default: "" },
    subheading: { type: String, default: "" },
    link: { type: String, default: "" },
  },
  { _id: false }
);

const TestimonialSchema = new Schema(
  {
    quote: { type: String, default: "" },
    author: { type: String, default: "" },
    location: { type: String, default: "" },
    rating: { type: Number, default: 5 },
    avatar: { type: String, default: "" },
  },
  { _id: false }
);

const InstagramPostSchema = new Schema(
  {
    image: { type: String, default: "" },
    link: { type: String, default: "" },
    caption: { type: String, default: "" },
  },
  { _id: false }
);

const ReelVideoSchema = new Schema(
  {
    videoUrl: { type: String, default: "" },
    poster: { type: String, default: "" },
    title: { type: String, default: "" },
    link: { type: String, default: "/shop" },
  },
  { _id: false }
);

/**
 * A size chart is a plain table: `columns` are the headers ("Size", "Chest",
 * "Length") and each row is a matching array of cells. Charts are keyed
 * (e.g. "tshirt", "polo") and a product points at one via `sizeChartKey`, so
 * one chart edit updates every product that uses it.
 */
const SizeChartSchema = new Schema(
  {
    key: { type: String, default: "" },
    title: { type: String, default: "" },
    unitNote: { type: String, default: "All measurements in inches." },
    columns: { type: [String], default: [] },
    rows: { type: [[String]], default: [] },
  },
  { _id: false }
);

const IntegrationsSchema = new Schema(
  {
    // Analytics & tracking — public ids only. Anything secret stays in env.
    ga4MeasurementId: { type: String, default: "" },
    metaPixelId: { type: String, default: "" },
    googleSiteVerification: { type: String, default: "" },

    // Conversational channels
    whatsappNumber: { type: String, default: "" }, // E.164, no "+"
    whatsappPrefillMessage: { type: String, default: "Hi ZenBlue, I have a question about" },
    whatsappCatalogUrl: { type: String, default: "" },

    // Contact page map (an <iframe> embed URL)
    mapEmbedUrl: { type: String, default: "" },

    // Instagram strip. Manual entries by default; swap for the Graph API later
    // without touching the storefront component.
    instagramHandle: { type: String, default: "" },
    instagramPosts: { type: [InstagramPostSchema], default: [] },
    reelVideos: { type: [ReelVideoSchema], default: [] },
  },
  { _id: false }
);

/**
 * Per-event, per-channel notification switches. The quotation requires each
 * trigger to be "switchable per channel from admin without code changes" —
 * lib/notifications/dispatch.ts reads this map before every send.
 */
const NotificationChannelSchema = new Schema(
  {
    email: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: false },
    sms: { type: Boolean, default: false },
  },
  { _id: false }
);

const NotificationsSchema = new Schema(
  {
    orderPlaced: { type: NotificationChannelSchema, default: () => ({}) },
    paymentConfirmed: { type: NotificationChannelSchema, default: () => ({}) },
    orderConfirmed: { type: NotificationChannelSchema, default: () => ({}) },
    orderShipped: { type: NotificationChannelSchema, default: () => ({}) },
    outForDelivery: { type: NotificationChannelSchema, default: () => ({}) },
    orderDelivered: { type: NotificationChannelSchema, default: () => ({}) },
    orderCancelled: { type: NotificationChannelSchema, default: () => ({}) },
    returnUpdate: { type: NotificationChannelSchema, default: () => ({}) },
    refundIssued: { type: NotificationChannelSchema, default: () => ({}) },
    abandonedCart: { type: NotificationChannelSchema, default: () => ({}) },
    backInStock: { type: NotificationChannelSchema, default: () => ({}) },
  },
  { _id: false }
);

const ReturnsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    /** Days after delivery during which a return can be raised. */
    windowDays: { type: Number, default: 7 },
    exchangeEnabled: { type: Boolean, default: true },
    storeCreditEnabled: { type: Boolean, default: true },
    /** Extra credit added when the customer takes store credit over a refund. */
    storeCreditBonusPercent: { type: Number, default: 0 },
    /** Shown on the order page above the "Request return" button. */
    policySummary: {
      type: String,
      default:
        "Unworn, unwashed items with original tags are eligible for return or exchange. Reverse pickup is free.",
    },
  },
  { _id: false }
);

const AbandonedCartSettingsSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    /** Idle minutes after which an active cart is considered abandoned. */
    abandonAfterMinutes: { type: Number, default: 60 },
    /** Hours after abandonment for each of the three nudges. */
    step1AfterHours: { type: Number, default: 1 },
    step2AfterHours: { type: Number, default: 24 },
    step3AfterHours: { type: Number, default: 72 },
    /** Optional incentive attached to the later steps only. */
    incentiveCouponCode: { type: String, default: "" },
    incentiveFromStep: { type: Number, default: 3 },
    recoveryLinkExpiryHours: { type: Number, default: 168 },
  },
  { _id: false }
);

const ShippingSchema = new Schema(
  {
    provider: { type: String, enum: ["manual", "shiprocket", "delhivery"], default: "manual" },
    /** Origin pincode — the aggregator needs it for rate and serviceability. */
    pickupPincode: { type: String, default: "" },
    pickupLocationName: { type: String, default: "Primary" },
    defaultWeightKg: { type: Number, default: 0.3 },
    defaultLengthCm: { type: Number, default: 30 },
    defaultBreadthCm: { type: Number, default: 24 },
    defaultHeightCm: { type: Number, default: 4 },
    codEnabled: { type: Boolean, default: true },
    codExtraFee: { type: Number, default: 0 },
    /** Shown on the PDP and cart as an expectation, not a guarantee. */
    estimatedDeliveryDays: { type: String, default: "3-6 business days" },
  },
  { _id: false }
);

const NewsletterSchema = new Schema(
  {
    enabled: { type: Boolean, default: true },
    heading: { type: String, default: "Join the ZenBlue list" },
    subtext: { type: String, default: "New drops, restocks and private sales. No noise." },
    buttonText: { type: String, default: "Subscribe" },
    successMessage: { type: String, default: "You are on the list." },
  },
  { _id: false }
);

// ---- Section sub-schemas -----------------------------------------------

const BrandSchema = new Schema(
  {
    storeName: { type: String, default: "Store" },
    tagline: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    /** Reversed mark for dark grounds (colour directions A and C). */
    logoDarkUrl: { type: String, default: "" },
    faviconUrl: { type: String, default: "" },
  },
  { _id: false }
);

const SeoSchema = new Schema(
  {
    metaTitle: { type: String, default: "E-Commerce Store" },
    metaDescription: { type: String, default: "" },
  },
  { _id: false }
);

const ThemeSchema = new Schema(
  {
    /**
     * Which ZenBlue colour direction from the brand deck is live: A (Midnight
     * Steel), B (Ivory & Navy — selected), C (Navy & Champagne) or D
     * (Editorial Grey). See lib/theme.ts for the token values.
     */
    palette: { type: String, enum: ["A", "B", "C", "D"], default: "B" },
    /**
     * Optional per-site overrides. Left blank, the palette's own values win —
     * these exist so the client can nudge a single colour without forking a
     * whole direction.
     */
    primaryColor: { type: String, default: "" },
    primaryForeground: { type: String, default: "" },
  },
  { _id: false }
);

const CommerceSchema = new Schema(
  {
    currencySymbol: { type: String, default: "₹" },
    currencyCode: { type: String, default: "INR" },
    shippingFee: { type: Number, default: 0 },
    freeShippingThreshold: { type: Number, default: 0 },
    codEnabled: { type: Boolean, default: true },
    razorpayEnabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const AnnouncementSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    text: { type: String, default: "" },
    link: { type: String, default: "" },
  },
  { _id: false }
);

const HeroSchema = new Schema(
  {
    title: { type: String, default: "Welcome to the Store" },
    subtitle: { type: String, default: "Quality products, fair prices, fast shipping." },
    ctaText: { type: String, default: "Shop Now" },
    ctaLink: { type: String, default: "/shop" },
    backgroundImage: { type: String, default: "" },
    mobileBackgroundImage: { type: String, default: "" },
  },
  { _id: false }
);

const HomeSchema = new Schema(
  {
    /** Hero is a slider: more than one slide auto-rotates, one renders static. */
    heroSlides: { type: [BannerSchema], default: [] },
    hero: { type: HeroSchema, default: () => ({}) },
    categoriesHeading: { type: String, default: "Shop by Category" },
    featuredHeading: { type: String, default: "Featured Products" },
    newArrivalsHeading: { type: String, default: "New Arrivals" },
    bestSellersHeading: { type: String, default: "Best Sellers" },
    testimonialsHeading: { type: String, default: "What our customers say" },
    instagramHeading: { type: String, default: "@zenblue on Instagram" },
    showNewArrivals: { type: Boolean, default: true },
    showBestSellers: { type: Boolean, default: true },
    highlights: { type: [HighlightSchema], default: [] },
    banners: { type: [BannerSchema], default: [] },
    testimonials: { type: [TestimonialSchema], default: [] },
  },
  { _id: false }
);

const HeaderSchema = new Schema(
  {
    navLinks: { type: [HeaderLinkSchema], default: [] },
  },
  { _id: false }
);

const FooterSchema = new Schema(
  {
    about: { type: String, default: "" },
    columns: { type: [FooterColumnSchema], default: [] },
    copyrightText: { type: String, default: "" },
  },
  { _id: false }
);

const ContactSchema = new Schema(
  {
    email: { type: String, default: "" },
    /** Separate from the general enquiries address, printed on order emails. */
    supportEmail: { type: String, default: "" },
    phone: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    address: { type: String, default: "" },
    businessHours: { type: String, default: "" },
  },
  { _id: false }
);

const SocialSchema = new Schema(
  {
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    twitter: { type: String, default: "" },
    youtube: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    pinterest: { type: String, default: "" },
  },
  { _id: false }
);


// ---- Root schema --------------------------------------------------------

const SiteSettingsSchema = new Schema(
  {
    // Guarantees a single row; PUT upserts against this key.
    singletonKey: { type: String, default: "site", unique: true, index: true },

    brand: { type: BrandSchema, default: () => ({}) },
    seo: { type: SeoSchema, default: () => ({}) },
    theme: { type: ThemeSchema, default: () => ({}) },
    commerce: { type: CommerceSchema, default: () => ({}) },
    announcement: { type: AnnouncementSchema, default: () => ({}) },
    home: { type: HomeSchema, default: () => ({}) },
    header: { type: HeaderSchema, default: () => ({}) },
    footer: { type: FooterSchema, default: () => ({}) },
    contact: { type: ContactSchema, default: () => ({}) },
    social: { type: SocialSchema, default: () => ({}) },

    // ZenBlue additions
    integrations: { type: IntegrationsSchema, default: () => ({}) },
    notifications: { type: NotificationsSchema, default: () => ({}) },
    returns: { type: ReturnsSchema, default: () => ({}) },
    abandonedCart: { type: AbandonedCartSettingsSchema, default: () => ({}) },
    shipping: { type: ShippingSchema, default: () => ({}) },
    newsletter: { type: NewsletterSchema, default: () => ({}) },
    sizeCharts: { type: [SizeChartSchema], default: [] },
  },
  { timestamps: true }
);

export default models.SiteSettings || model("SiteSettings", SiteSettingsSchema);
