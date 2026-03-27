import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        edge: {
          bg: "#09090b",
          surface: "#111113",
          "surface-2": "#161618",
          border: "#1e1e22",
          "border-2": "#2a2a2e",
          muted: "#63636e",
          dim: "#3e3e44",
          text: "#fafafa",
          "text-2": "#a1a1a6",
        },
        accent: {
          green: "#34d399",
          red: "#f87171",
          blue: "#818cf8",
          amber: "#fbbf24",
          purple: "#a78bfa",
          cyan: "#22d3ee",
        },
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      backgroundImage: {
        "twilight-gradient":
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 40%, transparent 70%)",
        "twilight-subtle":
          "radial-gradient(ellipse 60% 40% at 80% 100%, rgba(99, 102, 241, 0.05) 0%, transparent 60%)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        "pulse-soft": "pulseSoft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "border-rotate": "borderRotate 4s linear infinite",
        "border-fizzle": "borderRotate 1.5s linear infinite",
        "pulse-green": "pulseGreen 2s infinite",
        "scale-in": "scaleIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        borderRotate: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        pulseGreen: {
          "0%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0.4)" },
          "70%": { boxShadow: "0 0 0 8px rgba(52, 211, 153, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(52, 211, 153, 0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
