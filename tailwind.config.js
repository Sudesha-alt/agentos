/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#080810",
        ink: "#F0EEE8",
        "ink-dim": "#A0A0AE",
        "ink-mute": "#6B6B7B",
        indigo: {
          DEFAULT: "#6366F1",
          glow: "#6366F1",
          deep: "#4F46E5",
        },
        hairline: "#1E1E2E",
        "hairline-strong": "#2A2A3D",
        surface: "#0E0E18",
        "surface-2": "#12121F",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Geist Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
        display: [
          "Cormorant Garamond",
          "ui-serif",
          "Georgia",
          "serif",
        ],
        serif: [
          "Cormorant Garamond",
          "ui-serif",
          "Georgia",
          "serif",
        ],
      },
      letterSpacing: {
        tightest: "-0.04em",
        "tighter-2": "-0.03em",
      },
      fontSize: {
        "display-xl": ["clamp(2.75rem, 6vw, 5.5rem)", { lineHeight: "0.98", letterSpacing: "-0.04em" }],
        "display-lg": ["clamp(2.25rem, 4.5vw, 4rem)", { lineHeight: "1.02", letterSpacing: "-0.035em" }],
        "display-md": ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      boxShadow: {
        "glow-indigo": "0 0 0 1px rgba(99,102,241,0.35), 0 0 40px -10px rgba(99,102,241,0.55)",
        "glow-soft": "0 0 60px -20px rgba(99,102,241,0.45)",
        "inset-hair": "inset 0 0 0 1px rgba(255,255,255,0.04)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(240,238,232,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(240,238,232,0.03) 1px, transparent 1px)",
        "fade-bottom": "linear-gradient(to bottom, transparent, #080810 90%)",
        "fade-top": "linear-gradient(to top, transparent, #080810 90%)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      keyframes: {
        blink: {
          "0%, 49%": { opacity: "1" },
          "50%, 100%": { opacity: "0" },
        },
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.65" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        floatDot: {
          "0%": { offsetDistance: "0%" },
          "100%": { offsetDistance: "100%" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      animation: {
        blink: "blink 1s steps(1) infinite",
        "pulse-ring": "pulseRing 2.4s cubic-bezier(0.16,1,0.3,1) infinite",
        scanline: "scanline 6s linear infinite",
      },
      transitionTimingFunction: {
        precise: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
