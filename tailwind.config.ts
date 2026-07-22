import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          DEFAULT: "#050505",
          900: "#0a0a0b",
          800: "#101012",
        },
        accent: {
          DEFAULT: "#3B82F6",
          soft: "#60A5FA",
          deep: "#1D4ED8",
        },
        glass: "rgba(255,255,255,0.08)",
        "glass-strong": "rgba(255,255,255,0.11)",
        hairline: "rgba(255,255,255,0.12)",
        secondary: "#9CA3AF",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tightest: "-0.045em",
        tighter2: "-0.03em",
      },
      maxWidth: {
        container: "1200px",
        prose2: "680px",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        glass: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 20px 60px -20px rgba(0,0,0,0.7)",
        "glow-sm": "0 0 40px -8px rgba(59,130,246,0.45)",
        glow: "0 0 80px -16px rgba(59,130,246,0.55)",
        "glow-lg": "0 0 160px -20px rgba(59,130,246,0.5)",
        lift: "0 30px 80px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        "radial-fade":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(59,130,246,0.18), transparent 70%)",
        "grid-fade":
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        "text-fade":
          "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.72) 100%)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
        "spin-slow": {
          to: { transform: "rotate(360deg)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        float: "float 8s ease-in-out infinite",
        "pulse-glow": "pulse-glow 4s ease-in-out infinite",
        "spin-slow": "spin-slow 40s linear infinite",
      },
      transitionTimingFunction: {
        premium: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
