import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "var(--paper)", 2: "var(--paper-2)" },
        card: "var(--card)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        line: "var(--line)",
        night: { DEFAULT: "var(--night)", 2: "var(--night-2)" },
        verdigris: {
          100: "var(--verdigris-100)",
          700: "var(--verdigris-700)",
          800: "var(--verdigris-800)",
        },
        ochre: { 100: "var(--ochre-100)", 500: "var(--ochre-500)" },
        moss: { 100: "var(--moss-100)", 600: "var(--moss-600)" },
        brick: { 100: "var(--brick-100)", 600: "var(--brick-600)" },
        slate: { 100: "var(--slate-100)", 500: "var(--slate-500)" },
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
      },
      fontFamily: {
        serif: ["Newsreader", "Charter", "Georgia", "serif"],
        sans: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
