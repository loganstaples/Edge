import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        edge: {
          bg: "#08090e",
          surface: "#0e1018",
          "surface-2": "#141620",
          border: "#1a1d2e",
          "border-2": "#252940",
          muted: "#5a5f7a",
          dim: "#3a3f55",
          text: "#eaeaf0",
          "text-2": "#a0a3b5",
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
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-soft": "pulseSoft 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "border-rotate": "borderRotate 4s linear infinite",
        "border-fizzle": "borderRotate 1.5s linear infinite",
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
      },
    },
  },
  plugins: [],
};
export default config;
