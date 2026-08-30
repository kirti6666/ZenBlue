"use client";

import { useEffect, useState } from "react";
import { MAX_HERO_SLIDES } from "@/lib/site-settings-constants";
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { SingleImageUpload } from "@/components/admin/SingleImageUpload";
import { SingleVideoUpload } from "@/components/admin/SingleVideoUpload";
import type { SiteSettingsData } from "@/lib/site-settings";
import { PALETTES, type PaletteKey } from "@/lib/theme";
import { CardListSkeleton, Skeleton } from "@/components/ui/Skeleton";
import { RETURN_WINDOW_STATEMENT } from "@/lib/return-policy";

/* ------------------------------------------------------------------ *
 * Immutable nested-path helpers
 * Lets every field just call set("home.hero.title", value) or
 * set(["footer","columns",0,"links",1,"label"], value) without hand-writing
 * spread updates for deeply nested state.
 * ------------------------------------------------------------------ */
type PathSeg = string | number;
type Path = string | PathSeg[];

function toSegs(path: Path): PathSeg[] {
  return Array.isArray(path) ? path : path.split(".");
}

function setByPath<T>(obj: T, path: Path, value: unknown): T {
  const segs = toSegs(path);
  if (segs.length === 0) return value as T;
  const [head, ...rest] = segs;
  const clone: any = Array.isArray(obj) ? [...(obj as any)] : { ...(obj as any) };
  clone[head as any] = rest.length ? setByPath(clone[head as any], rest, value) : value;
  return clone;
}

/* ------------------------------------------------------------------ *
 * Small field primitives (match the app's plain-Tailwind admin style)
 * ------------------------------------------------------------------ */
function Text({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border px-3 py-2"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <textarea
        value={value ?? ""}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border px-3 py-2"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border px-3 py-2"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`shrink-0 w-11 h-6 rounded-full transition relative ${value ? "bg-primary" : "bg-gray-300"
          }`}
        aria-pressed={value}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? "left-[22px]" : "left-0.5"
            }`}
        />
      </button>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded border cursor-pointer"
        />
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border px-3 py-2 font-mono text-sm"
        />
      </div>
    </div>
  );
}

/** Card wrapper for a repeatable list item, with reorder + delete controls. */
function ItemCard({
  index,
  total,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-4 space-y-3 bg-gray-50/50">
      <div className="flex justify-end gap-1">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          title="Move up"
        >
          <ArrowUp size={15} />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
          title="Move down"
        >
          <ArrowDown size={15} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1 text-red-500 hover:text-red-700"
          title="Remove"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-sm rounded-md border border-dashed px-3 py-2 text-gray-600 hover:border-gray-500"
    >
      <Plus size={15} /> {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */

const TABS = [
  "Branding",
  "SEO",
  "Theme",
  "Commerce",
  "Homepage",
  "Navigation",
  "Footer",
  "Contact & Social",
  "Integrations",
  "Notifications",
  "Returns",
  "Shipping",
  "Size charts",
] as const;
type Tab = (typeof TABS)[number];

/**
 * The notification events an admin can switch per channel. The keys match the
 * `notifications` group in SiteSettings; lib/notifications/dispatch.ts maps
 * each message type onto one of them.
 */
const NOTIFICATION_EVENTS = [
  { key: "orderPlaced", label: "Order placed" },
  { key: "paymentConfirmed", label: "Payment confirmed" },
  { key: "orderConfirmed", label: "Order confirmed / packing" },
  { key: "orderShipped", label: "Shipped (with AWB)" },
  { key: "outForDelivery", label: "Out for delivery" },
  { key: "orderDelivered", label: "Delivered" },
  { key: "orderCancelled", label: "Order cancelled" },
  { key: "returnUpdate", label: "Return status update" },
  { key: "refundIssued", label: "Refund or store credit issued" },
  { key: "abandonedCart", label: "Abandoned cart recovery" },
  { key: "backInStock", label: "Back in stock alert" },
] as const;

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SiteSettingsData | null>(null);
  const [tab, setTab] = useState<Tab>("Branding");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => setMessage({ type: "err", text: "Failed to load settings" }));
  }, []);

  // Generic setter usable by every field: set("home.hero.title", value)
  const set = (path: Path, value: unknown) =>
    setSettings((prev) => (prev ? setByPath(prev, path, value) : prev));

  // Array helpers ---------------------------------------------------
  const pushItem = (path: Path, item: unknown) =>
    setSettings((prev) => {
      if (!prev) return prev;
      const segs = toSegs(path);
      const current = (getByPath(prev, segs) as unknown[]) ?? [];
      return setByPath(prev, segs, [...current, item]);
    });

  const removeItem = (path: Path, index: number) =>
    setSettings((prev) => {
      if (!prev) return prev;
      const segs = toSegs(path);
      const current = [...((getByPath(prev, segs) as unknown[]) ?? [])];
      current.splice(index, 1);
      return setByPath(prev, segs, current);
    });

  const moveItem = (path: Path, from: number, to: number) =>
    setSettings((prev) => {
      if (!prev) return prev;
      const segs = toSegs(path);
      const current = [...((getByPath(prev, segs) as unknown[]) ?? [])];
      if (to < 0 || to >= current.length) return prev;
      const [moved] = current.splice(from, 1);
      current.splice(to, 0, moved);
      return setByPath(prev, segs, current);
    });

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error || "Failed to save" });
        return;
      }
      setSettings(data.settings);
      setMessage({ type: "ok", text: "Settings saved. Refresh the storefront to see changes." });
    } catch {
      setMessage({ type: "err", text: "Something went wrong" });
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      // <div>
      //   <h1 className="text-2xl font-bold mb-6">Site Settings</h1>
      //   <p className="text-gray-400 text-sm"><CardListSkeleton count={5} key={5} /></p>
      // </div>
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const s = settings;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Site Settings</h1>
          <p className="text-sm text-gray-400">
            Everything the storefront shows — branding, homepage, navigation, footer, commerce.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {message && (
        <p
          className={`mb-4 text-sm rounded-md px-3 py-2 ${message.type === "ok"
            ? "bg-green-50 text-green-700"
            : "bg-red-50 text-red-600"
            }`}
        >
          {message.text}
        </p>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b mb-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${tab === t
              ? "border-primary font-medium"
              : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ------------------------- BRANDING ------------------------- */}
      {tab === "Branding" && (
        <div className="space-y-5">
          <Text label="Store name" value={s.brand.storeName} onChange={(v) => set("brand.storeName", v)} />
          <Text label="Tagline" value={s.brand.tagline} onChange={(v) => set("brand.tagline", v)} />
          <SingleImageUpload
            label="Logo — for light backgrounds (directions B and D)"
            value={s.brand.logoUrl}
            onChange={(v) => set("brand.logoUrl", v)}
          />
          <Text
            label="Light logo URL or local path"
            value={s.brand.logoUrl}
            onChange={(v) => set("brand.logoUrl", v)}
          />
          <SingleImageUpload
            label="Logo — reversed, for dark backgrounds (directions A and C)"
            value={s.brand.logoDarkUrl}
            onChange={(v) => set("brand.logoDarkUrl", v)}
          />
          <Text
            label="Dark logo URL or local path"
            value={s.brand.logoDarkUrl}
            onChange={(v) => set("brand.logoDarkUrl", v)}
          />
          <p className="text-sm text-gray-500">
            The header picks whichever suits the live colour direction. The supplied navy-on-white
            ZenBlue mark is set as the light-background logo. Use the reversed slot for a white mark
            on dark backgrounds. You can upload an image or paste a public URL/local path; leave
            either blank to fall back to the other, or clear both to show the store name as type.
          </p>
          <SingleImageUpload
            label="Favicon (optional)"
            value={s.brand.faviconUrl}
            onChange={(v) => set("brand.faviconUrl", v)}
          />
        </div>
      )}

      {/* ------------------------- SEO ------------------------------ */}
      {tab === "SEO" && (
        <div className="space-y-5">
          <Text
            label="Meta title"
            value={s.seo.metaTitle}
            onChange={(v) => set("seo.metaTitle", v)}
            hint="Shown in the browser tab and search results."
          />
          <TextArea
            label="Meta description"
            value={s.seo.metaDescription}
            onChange={(v) => set("seo.metaDescription", v)}
          />
        </div>
      )}

      {/* ------------------------- THEME ---------------------------- */}
      {tab === "Theme" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-1">Colour direction</h3>
            <p className="text-sm text-gray-500 mb-4">
              The four directions from the ZenBlue brand deck. Switching one re-skins the whole
              site — storefront and admin — with no redeploy.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(PALETTES) as PaletteKey[]).map((key) => {
                const p = PALETTES[key];
                const active = s.theme.palette === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("theme.palette", key)}
                    aria-pressed={active}
                    className={`rounded-xl border p-4 text-left transition-colors ${
                      active ? "border-primary ring-1 ring-primary" : "border-line hover:border-primary"
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-heading">
                        <span className="mr-2 text-muted">{key}</span>
                        {p.name}
                      </span>
                      {active && <span className="text-xs text-success">Live</span>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{p.note}</p>

                    {/* Swatch row, in the order the tokens are used on a page. */}
                    <div className="mt-3 flex h-8 overflow-hidden rounded">
                      {[
                        p.tokens.background,
                        p.tokens.surface,
                        p.tokens.brand,
                        p.tokens.primary,
                        p.tokens.link,
                        p.tokens.heading,
                        p.tokens.border,
                      ].map((hex, i) => (
                        <span key={i} className="flex-1" style={{ background: hex }} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Overrides (optional)</h3>
              <p className="text-sm text-gray-500">
                Leave blank to use the chosen direction&rsquo;s own values. Only set these if you
                need to nudge one colour without forking a whole direction.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                label="Button colour"
                value={s.theme.primaryColor || PALETTES[(s.theme.palette as PaletteKey) ?? "B"].tokens.primary}
                onChange={(v) => set("theme.primaryColor", v)}
              />
              <ColorField
                label="Button text"
                value={
                  s.theme.primaryForeground ||
                  PALETTES[(s.theme.palette as PaletteKey) ?? "B"].tokens.primaryForeground
                }
                onChange={(v) => set("theme.primaryForeground", v)}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                set("theme.primaryColor", "");
                set("theme.primaryForeground", "");
              }}
              className="text-sm text-link underline underline-offset-4"
            >
              Clear overrides
            </button>
          </section>
        </div>
      )}

      {/* ------------------------- COMMERCE ------------------------- */}
      {tab === "Commerce" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Text
              label="Currency symbol"
              value={s.commerce.currencySymbol}
              onChange={(v) => set("commerce.currencySymbol", v)}
            />
            <Text
              label="Currency code"
              value={s.commerce.currencyCode}
              onChange={(v) => set("commerce.currencyCode", v)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <NumberField
              label="Shipping fee"
              value={s.commerce.shippingFee}
              onChange={(v) => set("commerce.shippingFee", v)}
            />
            <NumberField
              label="Free shipping over"
              value={s.commerce.freeShippingThreshold}
              onChange={(v) => set("commerce.freeShippingThreshold", v)}
              hint="Orders at/above this subtotal ship free."
            />
          </div>
          <Toggle
            label="Cash on Delivery"
            hint="Allow customers to place COD orders."
            value={s.commerce.codEnabled}
            onChange={(v) => set("commerce.codEnabled", v)}
          />
          <Toggle
            label="Razorpay (online payments)"
            hint="Show the Pay Online option at checkout."
            value={s.commerce.razorpayEnabled}
            onChange={(v) => set("commerce.razorpayEnabled", v)}
          />
        </div>
      )}

      {/* ------------------------- HOMEPAGE ------------------------ */}
      {tab === "Homepage" && (
        <div className="space-y-8">
          <section className="space-y-4">
            <h3 className="font-semibold">Responsive hero slider</h3>
            <p className="text-xs text-gray-400">
              Add up to {MAX_HERO_SLIDES} slides. Each slide has a square mobile image and a wide
              tablet/desktop image, so neither layout needs to crop the other one.
            </p>
            {s.home.heroSlides.map((slide, i) => (
              <ItemCard
                key={i}
                index={i}
                total={s.home.heroSlides.length}
                onMove={(from, to) => moveItem("home.heroSlides", from, to)}
                onRemove={(index) => removeItem("home.heroSlides", index)}
              >
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                  <SingleImageUpload
                    label="Tablet & desktop image (wide)"
                    aspect="banner"
                    value={slide.image}
                    onChange={(v) => set(["home", "heroSlides", i, "image"], v)}
                  />
                  <SingleImageUpload
                    label="Mobile image (1:1)"
                    aspect="square"
                    value={slide.mobileImage ?? ""}
                    onChange={(v) => set(["home", "heroSlides", i, "mobileImage"], v)}
                  />
                </div>
                <Text
                  label="Banner click link"
                  value={slide.link ?? "/shop"}
                  onChange={(v) => set(["home", "heroSlides", i, "link"], v)}
                />
              </ItemCard>
            ))}
            {s.home.heroSlides.length < MAX_HERO_SLIDES && (
              <AddButton
                label="Add responsive hero slide"
                onClick={() =>
                  pushItem("home.heroSlides", {
                    image: "",
                    mobileImage: "",
                    videoUrl: "",
                    heading: "",
                    subheading: "",
                    link: "/shop",
                  })
                }
              />
            )}
            <p className="text-xs text-gray-400">
              {s.home.heroSlides.length} of {MAX_HERO_SLIDES} slides added.
            </p>
          </section>

          <section className="space-y-4">
            <h3 className="font-semibold">Section headings</h3>
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Categories heading"
                value={s.home.categoriesHeading}
                onChange={(v) => set("home.categoriesHeading", v)}
              />
              <Text
                label="Featured heading"
                value={s.home.featuredHeading}
                onChange={(v) => set("home.featuredHeading", v)}
              />
              <Text
                label="New arrivals heading"
                value={s.home.newArrivalsHeading}
                onChange={(v) => set("home.newArrivalsHeading", v)}
              />
              <Text
                label="Best sellers heading"
                value={s.home.bestSellersHeading}
                onChange={(v) => set("home.bestSellersHeading", v)}
              />
              <Text
                label="Testimonials heading"
                value={s.home.testimonialsHeading}
                onChange={(v) => set("home.testimonialsHeading", v)}
              />
              <Text
                label="Instagram heading"
                value={s.home.instagramHeading}
                onChange={(v) => set("home.instagramHeading", v)}
              />
            </div>
            <Toggle
              label="Show the New Arrivals row"
              value={s.home.showNewArrivals}
              onChange={(v) => set("home.showNewArrivals", v)}
            />
            <Toggle
              label="Show the Best Sellers row"
              value={s.home.showBestSellers}
              onChange={(v) => set("home.showBestSellers", v)}
            />
            <p className="text-xs text-gray-400">
              A row hides itself automatically when it has nothing to show, so an empty catalogue
              never leaves a bare heading on the page.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Testimonials</h3>
            <p className="text-xs text-gray-400">
              The first three are shown. Use real customer quotes — specific ones convert.
            </p>
            {s.home.testimonials.map((t, i) => (
              <ItemCard
                key={i}
                index={i}
                total={s.home.testimonials.length}
                onMove={(f, to) => moveItem("home.testimonials", f, to)}
                onRemove={(idx) => removeItem("home.testimonials", idx)}
              >
                <TextArea
                  label="Quote"
                  value={t.quote}
                  onChange={(v) => set(["home", "testimonials", i, "quote"], v)}
                  rows={3}
                />
                <div className="grid grid-cols-3 gap-4">
                  <Text
                    label="Author"
                    value={t.author}
                    onChange={(v) => set(["home", "testimonials", i, "author"], v)}
                  />
                  <Text
                    label="Location"
                    value={t.location}
                    onChange={(v) => set(["home", "testimonials", i, "location"], v)}
                  />
                  <NumberField
                    label="Rating (1-5)"
                    value={t.rating}
                    onChange={(v) => set(["home", "testimonials", i, "rating"], v)}
                  />
                </div>
              </ItemCard>
            ))}
            <AddButton
              label="Add testimonial"
              onClick={() =>
                pushItem("home.testimonials", {
                  quote: "",
                  author: "",
                  location: "",
                  rating: 5,
                  avatar: "",
                })
              }
            />
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Feature highlights</h3>
            <p className="text-xs text-gray-400">
              The small trust strip (e.g. Fast Shipping / Secure Payments). Icon is any{" "}
              <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer" className="underline">
                Lucide icon
              </a>{" "}
              name like <code>Truck</code>.
            </p>
            {s.home.highlights.map((h, i) => (
              <ItemCard
                key={i}
                index={i}
                total={s.home.highlights.length}
                onMove={(f, t) => moveItem("home.highlights", f, t)}
                onRemove={(idx) => removeItem("home.highlights", idx)}
              >
                <div className="grid grid-cols-3 gap-3">
                  <Text label="Icon" value={h.icon} onChange={(v) => set(["home", "highlights", i, "icon"], v)} />
                  <Text label="Title" value={h.title} onChange={(v) => set(["home", "highlights", i, "title"], v)} />
                  <Text
                    label="Subtitle"
                    value={h.subtitle}
                    onChange={(v) => set(["home", "highlights", i, "subtitle"], v)}
                  />
                </div>
              </ItemCard>
            ))}
            <AddButton
              label="Add highlight"
              onClick={() => pushItem("home.highlights", { icon: "", title: "", subtitle: "" })}
            />
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Promo banners</h3>
            <p className="text-xs text-gray-400">Full-width promotional banners rendered under the categories grid.</p>
            {s.home.banners.map((b, i) => (
              <ItemCard
                key={i}
                index={i}
                total={s.home.banners.length}
                onMove={(f, t) => moveItem("home.banners", f, t)}
                onRemove={(idx) => removeItem("home.banners", idx)}
              >
                <SingleImageUpload
                  label="Banner image"
                  aspect="banner"
                  value={b.image}
                  onChange={(v) => set(["home", "banners", i, "image"], v)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Text label="Heading" value={b.heading} onChange={(v) => set(["home", "banners", i, "heading"], v)} />
                  <Text
                    label="Subheading"
                    value={b.subheading}
                    onChange={(v) => set(["home", "banners", i, "subheading"], v)}
                  />
                </div>
                <Text label="Link" value={b.link} onChange={(v) => set(["home", "banners", i, "link"], v)} />
              </ItemCard>
            ))}
            <AddButton
              label="Add banner"
              onClick={() =>
                pushItem("home.banners", { image: "", heading: "", subheading: "", link: "" })
              }
            />
          </section>
        </div>
      )}

      {/* ------------------------- NAVIGATION ---------------------- */}
      {tab === "Navigation" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Links shown in the storefront header (besides Cart and account).</p>
          {s.header.navLinks.map((l, i) => (
            <ItemCard
              key={i}
              index={i}
              total={s.header.navLinks.length}
              onMove={(f, t) => moveItem("header.navLinks", f, t)}
              onRemove={(idx) => removeItem("header.navLinks", idx)}
            >
              <div className="grid grid-cols-2 gap-3">
                <Text label="Label" value={l.label} onChange={(v) => set(["header", "navLinks", i, "label"], v)} />
                <Text label="Href" value={l.href} onChange={(v) => set(["header", "navLinks", i, "href"], v)} />
              </div>
              <div className="space-y-2 rounded-md border bg-white p-3">
                <div>
                  <p className="text-sm font-medium">Dropdown options</p>
                  <p className="text-xs text-gray-400">
                    These links appear in this menu on desktop and inside its mobile accordion.
                  </p>
                </div>
                {(l.children ?? []).map((child, childIndex) => (
                  <div
                    key={childIndex}
                    className="grid gap-2 rounded-md border bg-gray-50/60 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
                  >
                    <Text
                      label={`Option ${childIndex + 1}`}
                      value={child.label}
                      onChange={(v) =>
                        set(["header", "navLinks", i, "children", childIndex, "label"], v)
                      }
                    />
                    <Text
                      label="Destination"
                      value={child.href}
                      placeholder="/category/example"
                      onChange={(v) =>
                        set(["header", "navLinks", i, "children", childIndex, "href"], v)
                      }
                    />
                    <div className="flex h-10 items-center justify-end gap-1">
                      <button
                        type="button"
                        disabled={childIndex === 0}
                        onClick={() =>
                          moveItem(
                            ["header", "navLinks", i, "children"],
                            childIndex,
                            childIndex - 1
                          )
                        }
                        className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move option up"
                        aria-label={`Move ${child.label || `option ${childIndex + 1}`} up`}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={childIndex === (l.children?.length ?? 0) - 1}
                        onClick={() =>
                          moveItem(
                            ["header", "navLinks", i, "children"],
                            childIndex,
                            childIndex + 1
                          )
                        }
                        className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move option down"
                        aria-label={`Move ${child.label || `option ${childIndex + 1}`} down`}
                      >
                        <ArrowDown size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          removeItem(["header", "navLinks", i, "children"], childIndex)
                        }
                        className="p-1.5 text-red-500 hover:text-red-700"
                        title="Remove option"
                        aria-label={`Remove ${child.label || `option ${childIndex + 1}`}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                <AddButton
                  label="Add dropdown option"
                  onClick={() =>
                    pushItem(["header", "navLinks", i, "children"], {
                      label: "",
                      href: "",
                    })
                  }
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Mega-menu promotional images</p>
                <div className="grid gap-3 md:grid-cols-3">
                  {[0, 1, 2].map((imageIndex) => (
                    <div key={imageIndex} className="space-y-2">
                      <SingleImageUpload
                        label={`Image ${imageIndex + 1}`}
                        aspect="card"
                        value={l.promoImages?.[imageIndex] ?? ""}
                        onChange={(v) =>
                          set(["header", "navLinks", i, "promoImages", imageIndex], v)
                        }
                      />
                      <Text
                        label="Image URL"
                        value={l.promoImages?.[imageIndex] ?? ""}
                        placeholder="/banners/image.png or https://…"
                        onChange={(v) =>
                          set(["header", "navLinks", i, "promoImages", imageIndex], v)
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  These three cards appear when shoppers hover over this navigation link.
                </p>
              </div>
            </ItemCard>
          ))}
          <AddButton
            label="Add nav link"
            onClick={() =>
              pushItem("header.navLinks", {
                label: "",
                href: "",
                children: [],
                promoImages: ["", "", ""],
              })
            }
          />
        </div>
      )}

      {/* ------------------------- FOOTER -------------------------- */}
      {tab === "Footer" && (
        <div className="space-y-6">
          <TextArea label="About text" value={s.footer.about} onChange={(v) => set("footer.about", v)} />
          <Text
            label="Copyright text"
            value={s.footer.copyrightText}
            onChange={(v) => set("footer.copyrightText", v)}
            hint="Use {year} to insert the current year automatically."
          />

          <div className="space-y-3">
            <h3 className="font-semibold">Footer columns</h3>
            {s.footer.columns.map((col, ci) => (
              <ItemCard
                key={ci}
                index={ci}
                total={s.footer.columns.length}
                onMove={(f, t) => moveItem("footer.columns", f, t)}
                onRemove={(idx) => removeItem("footer.columns", idx)}
              >
                <Text
                  label="Column title"
                  value={col.title}
                  onChange={(v) => set(["footer", "columns", ci, "title"], v)}
                />
                <div className="space-y-2 pl-3 border-l">
                  {col.links.map((lnk, li) => (
                    <div key={li} className="flex items-end gap-2">
                      <div className="flex-1 grid grid-cols-2 gap-2">
                        <Text
                          label="Label"
                          value={lnk.label}
                          onChange={(v) => set(["footer", "columns", ci, "links", li, "label"], v)}
                        />
                        <Text
                          label="Href"
                          value={lnk.href}
                          onChange={(v) => set(["footer", "columns", ci, "links", li, "href"], v)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(["footer", "columns", ci, "links"], li)}
                        className="p-2 text-red-500 hover:text-red-700"
                        title="Remove link"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <AddButton
                    label="Add link"
                    onClick={() => pushItem(["footer", "columns", ci, "links"], { label: "", href: "" })}
                  />
                </div>
              </ItemCard>
            ))}
            <AddButton
              label="Add column"
              onClick={() => pushItem("footer.columns", { title: "", links: [] })}
            />
          </div>
        </div>
      )}

      {/* ------------------------- CONTACT & SOCIAL ---------------- */}
      {tab === "Contact & Social" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className="font-semibold">Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <Text label="General email" value={s.contact.email} onChange={(v) => set("contact.email", v)} />
              <Text
                label="Support email (used on order emails)"
                value={s.contact.supportEmail}
                onChange={(v) => set("contact.supportEmail", v)}
              />
              <Text label="Phone" value={s.contact.phone} onChange={(v) => set("contact.phone", v)} />
              <Text
                label="Business hours"
                value={s.contact.businessHours}
                onChange={(v) => set("contact.businessHours", v)}
              />
            </div>
            <TextArea label="Address" value={s.contact.address} onChange={(v) => set("contact.address", v)} rows={2} />
          </section>
          <section className="space-y-4">
            <h3 className="font-semibold">Social links</h3>
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Instagram"
                value={s.social.instagram}
                onChange={(v) => set("social.instagram", v)}
                placeholder="https://instagram.com/zenblue"
              />
              <Text
                label="Facebook"
                value={s.social.facebook}
                onChange={(v) => set("social.facebook", v)}
                placeholder="https://facebook.com/zenblue"
              />
              <Text
                label="Twitter / X"
                value={s.social.twitter}
                onChange={(v) => set("social.twitter", v)}
              />
              <Text label="YouTube" value={s.social.youtube} onChange={(v) => set("social.youtube", v)} />
              <Text
                label="LinkedIn"
                value={s.social.linkedin}
                onChange={(v) => set("social.linkedin", v)}
              />
              <Text
                label="Pinterest"
                value={s.social.pinterest}
                onChange={(v) => set("social.pinterest", v)}
              />
            </div>
            <p className="text-sm text-gray-500">
              Each link appears as an icon in the footer only when it is filled in, so there are
              never dead icons. The WhatsApp button is configured separately under Integrations.
            </p>
          </section>
        </div>
      )}

      {/* ------------------------- INTEGRATIONS -------------------- */}
      {tab === "Integrations" && (
        <div className="space-y-6">
          <section className="space-y-4">
            <div>
              <h3 className="font-semibold">Analytics &amp; tracking</h3>
              <p className="text-sm text-gray-500">
                Public identifiers only. Nothing here is a secret — API keys live in environment
                variables, never in settings.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Google Analytics 4 measurement ID"
                value={s.integrations.ga4MeasurementId}
                onChange={(v) => set("integrations.ga4MeasurementId", v)}
              />
              <Text
                label="Meta Pixel ID"
                value={s.integrations.metaPixelId}
                onChange={(v) => set("integrations.metaPixelId", v)}
              />
            </div>
            <Text
              label="Google Search Console verification token"
              value={s.integrations.googleSiteVerification}
              onChange={(v) => set("integrations.googleSiteVerification", v)}
            />
          </section>

          <section className="space-y-4 border-t pt-5">
            <h3 className="font-semibold">WhatsApp</h3>
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Business number (country code, digits only)"
                value={s.integrations.whatsappNumber}
                onChange={(v) => set("integrations.whatsappNumber", v)}
              />
              <Text
                label="Catalogue link"
                value={s.integrations.whatsappCatalogUrl}
                onChange={(v) => set("integrations.whatsappCatalogUrl", v)}
              />
            </div>
            <Text
              label="Pre-filled chat message"
              value={s.integrations.whatsappPrefillMessage}
              onChange={(v) => set("integrations.whatsappPrefillMessage", v)}
            />
            <p className="text-sm text-gray-500">
              Leave the number blank to hide the floating chat button entirely.
            </p>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h3 className="font-semibold">Contact page map</h3>
            <Text
              label="Google Maps embed URL"
              value={s.integrations.mapEmbedUrl}
              onChange={(v) => set("integrations.mapEmbedUrl", v)}
            />
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Homepage reel videos</h3>
              <p className="text-sm text-gray-500">
                Add, reorder or replace up to five portrait videos in the Shop the Look section.
              </p>
            </div>
            {s.integrations.reelVideos.map((reel, i) => (
              <ItemCard
                key={`${reel.videoUrl}-${i}`}
                index={i}
                total={s.integrations.reelVideos.length}
                onMove={(from, to) => moveItem("integrations.reelVideos", from, to)}
                onRemove={(idx) => removeItem("integrations.reelVideos", idx)}
              >
                <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
                  <SingleVideoUpload
                    label={`Reel video ${i + 1}`}
                    value={reel.videoUrl}
                    onChange={(v) => set(["integrations", "reelVideos", i, "videoUrl"], v)}
                  />
                  <div className="space-y-3">
                    <Text
                      label="Video URL or local path"
                      value={reel.videoUrl}
                      onChange={(v) => set(["integrations", "reelVideos", i, "videoUrl"], v)}
                    />
                    <Text
                      label="Title"
                      value={reel.title}
                      onChange={(v) => set(["integrations", "reelVideos", i, "title"], v)}
                    />
                    <Text
                      label="Product or collection link"
                      value={reel.link}
                      onChange={(v) => set(["integrations", "reelVideos", i, "link"], v)}
                    />
                  </div>
                </div>
                <SingleImageUpload
                  label="Poster image (optional)"
                  value={reel.poster}
                  onChange={(v) => set(["integrations", "reelVideos", i, "poster"], v)}
                  aspect="card"
                />
                <Text
                  label="Poster URL or local path"
                  value={reel.poster}
                  onChange={(v) => set(["integrations", "reelVideos", i, "poster"], v)}
                />
              </ItemCard>
            ))}
            {s.integrations.reelVideos.length < 5 ? (
              <AddButton
                label="Add reel video"
                onClick={() =>
                  pushItem("integrations.reelVideos", {
                    videoUrl: "",
                    poster: "",
                    title: "",
                    link: "/shop",
                  })
                }
              />
            ) : (
              <p className="text-xs font-medium text-gray-500">Maximum 5 videos added.</p>
            )}
          </section>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Instagram strip</h3>
              <p className="text-sm text-gray-500">
                Add posts manually — no access token to expire and silently empty the section.
              </p>
            </div>
            <Text
              label="Handle (without @)"
              value={s.integrations.instagramHandle}
              onChange={(v) => set("integrations.instagramHandle", v)}
            />
            {s.integrations.instagramPosts.map((post, i) => (
              <ItemCard
                key={i}
                index={i}
                total={s.integrations.instagramPosts.length}
                onMove={(from, to) => moveItem("integrations.instagramPosts", from, to)}
                onRemove={(idx) => removeItem("integrations.instagramPosts", idx)}
              >
                <SingleImageUpload
                  label="Image"
                  value={post.image}
                  onChange={(v) => set(["integrations", "instagramPosts", i, "image"], v)}
                />
                <Text
                  label="Post link"
                  value={post.link}
                  onChange={(v) => set(["integrations", "instagramPosts", i, "link"], v)}
                />
                <Text
                  label="Caption (alt text)"
                  value={post.caption}
                  onChange={(v) => set(["integrations", "instagramPosts", i, "caption"], v)}
                />
              </ItemCard>
            ))}
            <AddButton
              label="Add post"
              onClick={() =>
                pushItem("integrations.instagramPosts", { image: "", link: "", caption: "" })
              }
            />
          </section>
        </div>
      )}

      {/* ------------------------- NOTIFICATIONS ------------------- */}
      {tab === "Notifications" && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Choose which channels each event goes out on. Turning a channel on here only takes
            effect once that provider is configured — until then the message is logged as
            &ldquo;skipped&rdquo; rather than failing.
          </p>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead>
                <tr>
                  <th className="border-b px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Event
                  </th>
                  {(["email", "whatsapp", "sms"] as const).map((c) => (
                    <th
                      key={c}
                      className="border-b px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NOTIFICATION_EVENTS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="border-b px-4 py-3">{label}</td>
                    {(["email", "whatsapp", "sms"] as const).map((channel) => (
                      <td key={channel} className="border-b px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`${label} via ${channel}`}
                          checked={
                            (s.notifications as any)[key]?.[channel] ?? false
                          }
                          onChange={(e) =>
                            set(["notifications", key, channel], e.target.checked)
                          }
                          className="h-4 w-4 accent-[var(--primary)]"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section className="space-y-4 border-t pt-5">
            <h3 className="font-semibold">Newsletter block</h3>
            <Toggle
              label="Show the newsletter signup in the footer"
              value={s.newsletter.enabled}
              onChange={(v) => set("newsletter.enabled", v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Heading"
                value={s.newsletter.heading}
                onChange={(v) => set("newsletter.heading", v)}
              />
              <Text
                label="Button text"
                value={s.newsletter.buttonText}
                onChange={(v) => set("newsletter.buttonText", v)}
              />
            </div>
            <Text
              label="Subtext"
              value={s.newsletter.subtext}
              onChange={(v) => set("newsletter.subtext", v)}
            />
            <Text
              label="Success message"
              value={s.newsletter.successMessage}
              onChange={(v) => set("newsletter.successMessage", v)}
            />
          </section>
        </div>
      )}

      {/* ------------------------- RETURNS ------------------------- */}
      {tab === "Returns" && (
        <div className="space-y-5">
          <Toggle
            label="Accept returns and exchanges"
            value={s.returns.enabled}
            onChange={(v) => set("returns.enabled", v)}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-sm font-medium">Return window</p>
              <div className="rounded-md border bg-gray-50 px-3 py-2 text-sm font-medium">
                7 days after delivery
              </div>
              <p className="mt-1 text-xs text-gray-500">Fixed store policy</p>
            </div>
            <NumberField
              label="Extra credit for choosing store credit (%)"
              value={s.returns.storeCreditBonusPercent}
              onChange={(v) => set("returns.storeCreditBonusPercent", v)}
            />
          </div>
          <Toggle
            label="Allow exchanges (not just refunds)"
            value={s.returns.exchangeEnabled}
            onChange={(v) => set("returns.exchangeEnabled", v)}
          />
          <Toggle
            label="Allow refunds as store credit"
            value={s.returns.storeCreditEnabled}
            onChange={(v) => set("returns.storeCreditEnabled", v)}
          />
          <TextArea
            label="Policy summary (shown above the return button)"
            value={s.returns.policySummary}
            onChange={(v) => set("returns.policySummary", v)}
            rows={3}
          />
          <p className="text-sm text-gray-500">
            {RETURN_WINDOW_STATEMENT} The window runs from the delivery date, not the order date.
            Keep the full policy page in sync under Content &amp; pages.
          </p>

          <section className="space-y-4 border-t pt-5">
            <h3 className="font-semibold">Abandoned cart recovery</h3>
            <Toggle
              label="Capture abandoned carts and send recovery messages"
              value={s.abandonedCart.enabled}
              onChange={(v) => set("abandonedCart.enabled", v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="Consider a cart abandoned after (minutes idle)"
                value={s.abandonedCart.abandonAfterMinutes}
                onChange={(v) => set("abandonedCart.abandonAfterMinutes", v)}
              />
              <NumberField
                label="Restore link expires after (hours)"
                value={s.abandonedCart.recoveryLinkExpiryHours}
                onChange={(v) => set("abandonedCart.recoveryLinkExpiryHours", v)}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <NumberField
                label="1st nudge (hours)"
                value={s.abandonedCart.step1AfterHours}
                onChange={(v) => set("abandonedCart.step1AfterHours", v)}
              />
              <NumberField
                label="2nd nudge (hours)"
                value={s.abandonedCart.step2AfterHours}
                onChange={(v) => set("abandonedCart.step2AfterHours", v)}
              />
              <NumberField
                label="3rd nudge (hours)"
                value={s.abandonedCart.step3AfterHours}
                onChange={(v) => set("abandonedCart.step3AfterHours", v)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Text
                label="Incentive coupon code (optional)"
                value={s.abandonedCart.incentiveCouponCode}
                onChange={(v) => set("abandonedCart.incentiveCouponCode", v)}
              />
              <NumberField
                label="Attach the coupon from step"
                value={s.abandonedCart.incentiveFromStep}
                onChange={(v) => set("abandonedCart.incentiveFromStep", v)}
              />
            </div>
            <p className="text-sm text-gray-500">
              Hold the incentive back to a later step — discounting the first nudge trains
              shoppers to abandon carts on purpose.
            </p>
          </section>
        </div>
      )}

      {/* ------------------------- SHIPPING ------------------------ */}
      {tab === "Shipping" && (
        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Courier integration</span>
            <select
              value={s.shipping.provider}
              onChange={(e) => set("shipping.provider", e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="manual">Manual — enter AWBs yourself</option>
              <option value="shiprocket">Shiprocket</option>
              <option value="delhivery">Delhivery</option>
            </select>
          </label>
          <p className="text-sm text-gray-500">
            Credentials for the live integrations are set as environment variables during handover.
            Manual mode is fully functional in the meantime — book on the courier&rsquo;s dashboard
            and paste the AWB into the shipping desk.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Text
              label="Pickup pincode"
              value={s.shipping.pickupPincode}
              onChange={(v) => set("shipping.pickupPincode", v)}
            />
            <Text
              label="Pickup location name"
              value={s.shipping.pickupLocationName}
              onChange={(v) => set("shipping.pickupLocationName", v)}
            />
          </div>

          <section className="space-y-4 border-t pt-5">
            <div>
              <h3 className="font-semibold">Default package</h3>
              <p className="text-sm text-gray-500">
                Used when a product has no dimensions of its own. Under-declaring weight is the
                usual cause of courier surcharges.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <NumberField
                label="Weight (kg)"
                value={s.shipping.defaultWeightKg}
                onChange={(v) => set("shipping.defaultWeightKg", v)}
              />
              <NumberField
                label="Length (cm)"
                value={s.shipping.defaultLengthCm}
                onChange={(v) => set("shipping.defaultLengthCm", v)}
              />
              <NumberField
                label="Breadth (cm)"
                value={s.shipping.defaultBreadthCm}
                onChange={(v) => set("shipping.defaultBreadthCm", v)}
              />
              <NumberField
                label="Height (cm)"
                value={s.shipping.defaultHeightCm}
                onChange={(v) => set("shipping.defaultHeightCm", v)}
              />
            </div>
          </section>

          <section className="space-y-4 border-t pt-5">
            <h3 className="font-semibold">Cash on delivery</h3>
            <Toggle
              label="Offer cash on delivery"
              value={s.shipping.codEnabled}
              onChange={(v) => set("shipping.codEnabled", v)}
            />
            <div className="grid grid-cols-2 gap-4">
              <NumberField
                label="COD handling fee"
                value={s.shipping.codExtraFee}
                onChange={(v) => set("shipping.codExtraFee", v)}
              />
              <Text
                label="Delivery estimate shown to shoppers"
                value={s.shipping.estimatedDeliveryDays}
                onChange={(v) => set("shipping.estimatedDeliveryDays", v)}
              />
            </div>
          </section>
        </div>
      )}

      {/* ------------------------- SIZE CHARTS --------------------- */}
      {tab === "Size charts" && (
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            Charts are shared: give each one a key (e.g. <code>tshirt</code>), then point products
            at that key so one edit updates every product using it. Rows must have the same number
            of cells as there are columns.
          </p>

          {s.sizeCharts.map((chart, i) => (
            <ItemCard
              key={i}
              index={i}
              total={s.sizeCharts.length}
              onMove={(from, to) => moveItem("sizeCharts", from, to)}
              onRemove={(idx) => removeItem("sizeCharts", idx)}
            >
              <div className="grid grid-cols-2 gap-4">
                <Text
                  label="Key (used on products)"
                  value={chart.key}
                  onChange={(v) => set(["sizeCharts", i, "key"], v)}
                />
                <Text
                  label="Title"
                  value={chart.title}
                  onChange={(v) => set(["sizeCharts", i, "title"], v)}
                />
              </div>
              <Text
                label="Unit note"
                value={chart.unitNote}
                onChange={(v) => set(["sizeCharts", i, "unitNote"], v)}
              />
              <Text
                label="Columns (comma separated)"
                value={chart.columns.join(", ")}
                onChange={(v) =>
                  set(
                    ["sizeCharts", i, "columns"],
                    v.split(",").map((c) => c.trim()).filter(Boolean)
                  )
                }
              />
              <TextArea
                label="Rows — one size per line, cells separated by commas"
                value={chart.rows.map((r) => r.join(", ")).join("\n")}
                onChange={(v) =>
                  set(
                    ["sizeCharts", i, "rows"],
                    v
                      .split("\n")
                      .map((line) => line.split(",").map((c) => c.trim()))
                      .filter((r) => r.some(Boolean))
                  )
                }
                rows={7}
              />
            </ItemCard>
          ))}

          <AddButton
            label="Add size chart"
            onClick={() =>
              pushItem("sizeCharts", {
                key: "",
                title: "",
                unitNote: "All measurements in inches.",
                columns: ["Size", "Chest", "Length"],
                rows: [],
              })
            }
          />
        </div>
      )}

      <div className="mt-8 pt-6 border-t">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

/** Read a value at a nested path (mirror of setByPath, used by array helpers). */
function getByPath(obj: unknown, path: Path): unknown {
  const segs = toSegs(path);
  return segs.reduce<any>((acc, seg) => (acc == null ? acc : acc[seg as any]), obj);
}
