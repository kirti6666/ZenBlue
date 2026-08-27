/**
 * ZenBlue colour directions — the four palettes from the brand deck
 * ("ZEN BLUE — WEBSITE COLOUR DIRECTIONS, PICK ONE LETTER").
 *
 * Direction B (Ivory & Navy) is the shipped default, per the client's
 * selection — an inverted, classical light ground. Note the deck's caveat on
 * this direction: it needs a DARK-GROUND logo, so the wordmark and any
 * uploaded logo asset must be the navy-on-light variant, not the reversed one.
 * The admin can still switch direction at /admin/settings → Theme without a
 * redeploy, so A/C/D can be previewed live.
 *
 * Every token below is emitted as a CSS custom property in app/layout.tsx and
 * consumed through Tailwind (see tailwind.config.ts), so components only ever
 * reference semantic names — `bg-surface`, `text-heading`, `border-line` —
 * never a raw hex.
 */

export type PaletteKey = "A" | "B" | "C" | "D";

export interface PaletteTokens {
  /** Page ground. */
  background: string;
  /** Cards, panels, raised areas sitting on the ground. */
  surface: string;
  /** Secondary surface — inputs, table stripes, hover states. */
  surfaceAlt: string;
  /** The navy the brand mark lives in. Used for brand fills, not body text. */
  brand: string;
  /** Primary button fill. */
  primary: string;
  /** Text/icon colour that sits on `primary`. */
  primaryForeground: string;
  /** Links and interactive text. */
  link: string;
  /** Headings. */
  heading: string;
  /** Body copy. */
  body: string;
  /** De-emphasised copy — captions, helper text. */
  muted: string;
  /** Hairlines, borders, dividers. */
  border: string;
  /** The one metallic accent. Rule: one accent per screen, under 10%. */
  accent: string;
  /** Pressed/active state of the accent. */
  accentPressed: string;
  /** True when the direction is a dark ground (drives `color-scheme`). */
  dark: boolean;
}

/**
 * Status colours are shared across all four directions (per the deck).
 * Each has a `strong` (solid fills, light grounds) and a `soft` (text/icons on
 * dark grounds) so both A/C (dark) and B/D (light) stay legible at AA.
 */
export const STATUS_COLORS = {
  success: { strong: "#2F6B45", soft: "#7FB08A", label: "In stock, order placed" },
  warning: { strong: "#8A6212", soft: "#D6A64A", label: "Low stock, offer ending" },
  error: { strong: "#A03028", soft: "#E0736A", label: "Payment failed, sold out" },
  sale: { strong: "#B4472F", soft: "#E08A6E", label: "Reduced price only" },
} as const;

export type StatusKey = keyof typeof STATUS_COLORS;

export const PALETTES: Record<PaletteKey, { name: string; note: string; tokens: PaletteTokens }> = {
  A: {
    name: "Midnight Steel",
    note: "Logo translated directly. No change to the mark.",
    tokens: {
      background: "#0B0C0E", // Obsidian
      surface: "#15171B", // Graphite
      surfaceAlt: "#1B1E24",
      brand: "#16233B", // Deep Navy
      primary: "#24406B", // Navy
      primaryForeground: "#E9EBED",
      link: "#5A82BE", // Steel Blue
      heading: "#E9EBED", // Platinum
      body: "#A7AEB5", // Silver
      muted: "#7C848D",
      border: "#22262C", // Gunmetal
      accent: "#5A82BE",
      accentPressed: "#3F6199",
      dark: true,
    },
  },
  B: {
    name: "Ivory & Navy",
    note: "Inverted, classical. Needs dark-ground logo.",
    tokens: {
      background: "#F6F5F2", // Ivory
      surface: "#FFFFFF",
      surfaceAlt: "#EFEEEA",
      brand: "#16233B", // Deep Navy
      primary: "#24406B", // Navy
      primaryForeground: "#FFFFFF",
      link: "#24406B",
      heading: "#16233B",
      body: "#2B2F35", // Charcoal
      muted: "#626B76", // Slate
      border: "#DEE2E6", // Silver Mist
      accent: "#8E99A4", // Steel
      accentPressed: "#6F7B87",
      dark: false,
    },
  },
  C: {
    name: "Navy & Champagne",
    note: "Warm metallic accent. Keep it under 10%.",
    tokens: {
      background: "#101319", // Ink
      surface: "#1A2338", // Midnight
      surfaceAlt: "#212C45",
      brand: "#1E3A63", // Navy
      primary: "#1E3A63",
      primaryForeground: "#F1EEE8",
      link: "#C6A972", // Champagne
      heading: "#F1EEE8", // Warm White
      body: "#A9B0B8", // Silver
      muted: "#828A93",
      border: "#252B36", // Slate Line
      accent: "#C6A972", // Champagne
      accentPressed: "#8A6F3C", // Bronze
      dark: true,
    },
  },
  D: {
    name: "Editorial Grey",
    note: "Neutral gallery wall. Garments carry colour.",
    tokens: {
      background: "#ECEEF0", // Fog
      surface: "#FFFFFF",
      surfaceAlt: "#F5F6F8",
      brand: "#0F1115", // Near Black
      primary: "#24406B", // Navy — actions only
      primaryForeground: "#FFFFFF",
      link: "#24406B",
      heading: "#1C1F24", // Charcoal
      body: "#1C1F24",
      muted: "#5C6570", // Cool Grey
      border: "#DCDFE3", // Line Grey
      accent: "#A0A8B0", // Silver
      accentPressed: "#7F8892",
      dark: false,
    },
  },
};

export const DEFAULT_PALETTE: PaletteKey = "B";

export function getPalette(key: string | undefined): PaletteTokens {
  return (PALETTES[key as PaletteKey] ?? PALETTES[DEFAULT_PALETTE]).tokens;
}

/**
 * Renders the palette (plus the shared status colours) as a `:root { ... }`
 * block. Injected once in the root layout so both the storefront and the admin
 * panel resolve the same variables.
 */
export function paletteToCssVars(t: PaletteTokens): string {
  const vars: Record<string, string> = {
    "--background": t.background,
    "--surface": t.surface,
    "--surface-alt": t.surfaceAlt,
    "--brand": t.brand,
    "--primary": t.primary,
    "--primary-foreground": t.primaryForeground,
    "--link": t.link,
    "--heading": t.heading,
    "--body": t.body,
    "--muted": t.muted,
    "--border": t.border,
    "--accent": t.accent,
    "--accent-pressed": t.accentPressed,
  };
  for (const [key, val] of Object.entries(STATUS_COLORS)) {
    vars[`--${key}`] = t.dark ? val.soft : val.strong;
    vars[`--${key}-strong`] = val.strong;
    vars[`--${key}-soft`] = val.soft;
  }
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `:root{color-scheme:${t.dark ? "dark" : "light"};${body}}`;
}
