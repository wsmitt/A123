import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        cyan: {
          DEFAULT: "var(--cyan)",
          dim: "var(--cyan-dim)",
          faint: "var(--cyan-faint)",
        },
        muted: "var(--text-muted)",
      },
      fontFamily: {
        mono: ["var(--font-mono)", "Share Tech Mono", "IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
