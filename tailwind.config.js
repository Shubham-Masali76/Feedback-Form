/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"DM Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        display: [
          '"Plus Jakarta Sans"',
          '"DM Sans"',
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        soft: "0 2px 15px -3px rgb(15 23 42 / 0.07), 0 4px 6px -4px rgb(15 23 42 / 0.05)",
        "soft-lg":
          "0 10px 40px -10px rgb(15 23 42 / 0.12), 0 4px 16px -4px rgb(15 23 42 / 0.06)",
        nav: "0 1px 0 0 rgb(15 23 42 / 0.06), 0 8px 24px -12px rgb(15 23 42 / 0.08)",
        "glow-blue":
          "0 8px 32px -8px rgb(37 99 235 / 0.35), 0 4px 12px -4px rgb(30 64 175 / 0.2)",
        "glow-emerald":
          "0 8px 28px -8px rgb(16 185 129 / 0.3)",
        inner: "inset 0 2px 4px 0 rgb(15 23 42 / 0.04)",
      },
      backgroundImage: {
        "mesh-light":
          "radial-gradient(at 40% 20%, rgb(219 234 254 / 0.5) 0px, transparent 50%), radial-gradient(at 80% 0%, rgb(224 231 255 / 0.35) 0px, transparent 50%), radial-gradient(at 0% 50%, rgb(241 245 249 / 0.8) 0px, transparent 50%)",
      },
      keyframes: {
        "toast-in": {
          from: { opacity: "0", transform: "translateX(12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "toast-in": "toast-in 0.25s ease-out",
        "float-slow": "float-slow 8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
}