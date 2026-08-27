/** Shared apparel color palette for product cards and variant pickers. */
const COLOR_SWATCHES: Record<string, string> = {
  "deep navy": "#16233B",
  navy: "#1F2A44",
  "off white": "#F6F2E8",
  ivory: "#F6F5F2",
  white: "#FFFFFF",
  black: "#111214",
  charcoal: "#34363A",
  grey: "#9CA3AF",
  gray: "#9CA3AF",
  olive: "#6B7043",
  beige: "#D8C7AA",
  bone: "#E3DAC8",
  cream: "#F1E5CB",
  sand: "#C8B28F",
  stone: "#A8A29A",
  khaki: "#A59B72",
  brown: "#704A35",
  tan: "#B68B5E",
  rust: "#A65335",
  blue: "#315A9B",
  green: "#35624A",
  teal: "#28706E",
  red: "#A63D35",
  maroon: "#702F3B",
  burgundy: "#6E2938",
  yellow: "#D6B84B",
  mustard: "#B68A2F",
  orange: "#C9783A",
  pink: "#D899A9",
  purple: "#745486",
};

export function swatchColor(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (COLOR_SWATCHES[normalized]) return COLOR_SWATCHES[normalized];
  const partial = Object.keys(COLOR_SWATCHES).find((key) => normalized.includes(key));
  return partial ? COLOR_SWATCHES[partial] : "#B8BDC4";
}
