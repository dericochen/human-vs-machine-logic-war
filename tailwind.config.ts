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
        // Referenced as semantic tokens; the canonical values live in globals.css :root.
        // Tailwind maps to the same hex so server-rendered classes match the CSS vars.
        void: "var(--void)",
        panel: "var(--panel)",
        panel2: "var(--panel-2)",
        line: "var(--line)",
        ink: "var(--ink)",
        inkdim: "var(--ink-dim)",
        neon: "var(--neon)",
        neonsoft: "var(--neon-soft)",
        violet: "var(--violet)",
        violetssoft: "var(--violet-soft)",
        alarm: "var(--alarm)",
        gold: "var(--gold)",
        win: "var(--win)",
        lose: "var(--lose)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"]
      },
      boxShadow: {
        neon: "0 0 0 1px var(--neon-soft), 0 0 18px -4px var(--neon-soft)",
        "neon-lg": "0 0 0 1px var(--neon), 0 0 34px -6px var(--neon)",
        violet: "0 0 0 1px var(--violet-soft), 0 0 20px -4px var(--violet-soft)"
      },
      animation: {
        "pulse-glow": "pulseGlow 2.4s ease-in-out infinite",
        "scan": "scan 3.2s linear infinite",
        "blink": "blink 1.1s steps(2, start) infinite",
        "float": "float 6s ease-in-out infinite"
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" }
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" }
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.25" }
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" }
        }
      }
    }
  },
  plugins: []
};

export default config;
