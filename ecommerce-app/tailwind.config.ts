import type { Config } from "tailwindcss";

/**
 * Colours here are all `var(--token)` references, never hex. The actual values
 * come from the ZenBlue palette chosen in Site Settings and are injected as
 * CSS custom properties by app/layout.tsx (see lib/theme.ts). That means
 * switching colour direction A→B→C→D re-skins the entire site with no rebuild.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        surface: {
          DEFAULT: "var(--surface)",
          alt: "var(--surface-alt)",
        },
        brand: "var(--brand)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        link: "var(--link)",
        heading: "var(--heading)",
        body: "var(--body)",
        muted: "var(--muted)",
        line: "var(--border)",
        accent: {
          DEFAULT: "var(--accent)",
          pressed: "var(--accent-pressed)",
        },
        success: "var(--success)",
        warning: "var(--warning)",
        error: "var(--error)",
        sale: "var(--sale)",
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      maxWidth: {
        page: "80rem",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.4s ease-out both",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
