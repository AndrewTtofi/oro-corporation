import type { Config } from "tailwindcss";

/**
 * Two-palette design system. Tokens come from the design export under ORO.zip.
 * Admin chrome  → cool gray  (entry: admin-client-profile.html)
 * Client chrome → warm off-white (8/12 exported screens)
 * Both share gold accent #C8A45A and near-black #0A0A0A.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "40px",
      screens: {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1180px",
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        // Shared
        accent: "#C8A45A",
        dark: "#0A0A0A",

        // Admin chrome
        admin: {
          bg: "#F9FAFB",
          surface: "#FFFFFF",
          fg: "#111827",
          muted: "#6B7280",
          border: "#E5E7EB",
        },

        // Client / marketing chrome
        client: {
          bg: "#FAF8F5",
          surface: "#FFFFFF",
          fg: "#2D2D2D",
          muted: "#666666",
          border: "#E8E4DF",
        },

        // Status palette (same in both)
        status: {
          "pending-bg": "#FEF3C7",
          "pending-fg": "#92400E",
          "approved-bg": "#D1FAE5",
          "approved-fg": "#065F46",
          "info-bg": "#DBEAFE",
          "info-fg": "#1E40AF",
          "done-bg": "#F3F4F6",
          "done-fg": "#374151",
          danger: "#DC2626",
        },
      },
      fontFamily: {
        display: ["'Playfair Display'", "serif"],
        body: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      fontSize: {
        h1: ["clamp(48px, 6vw, 84px)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        h2: ["clamp(36px, 4vw, 56px)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        h3: ["24px", { lineHeight: "1.25" }],
        lead: ["20px", { lineHeight: "1.5" }],
        body: ["17px", { lineHeight: "1.6" }],
        meta: ["14px", { lineHeight: "1.5" }],
      },
      borderRadius: {
        card: "12px",
        elem: "8px",
        inner: "6px",
      },
      boxShadow: {
        "card-hover": "0 20px 40px rgba(0,0,0,0.05)",
        "card-soft": "0 4px 20px rgba(0,0,0,0.03)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
      keyframes: {
        "pulse-accent": {
          "0%": { boxShadow: "0 0 0 0 rgba(200,164,90,0.4)" },
          "70%": { boxShadow: "0 0 0 10px rgba(200,164,90,0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(200,164,90,0)" },
        },
        "scale-in": {
          from: { transform: "scale(0)" },
          to: { transform: "scale(1)" },
        },
      },
      animation: {
        "pulse-accent": "pulse-accent 2s infinite",
        "scale-in": "scale-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
  },
  plugins: [],
};

export default config;
