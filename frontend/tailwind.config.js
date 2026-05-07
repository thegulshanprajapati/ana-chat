/** @type {import('tailwindcss').Config} */
const accentScale = {
  50: "rgb(var(--accent-50-rgb) / <alpha-value>)",
  100: "rgb(var(--accent-100-rgb) / <alpha-value>)",
  200: "rgb(var(--accent-200-rgb) / <alpha-value>)",
  300: "rgb(var(--accent-300-rgb) / <alpha-value>)",
  400: "rgb(var(--accent-400-rgb) / <alpha-value>)",
  500: "rgb(var(--accent-500-rgb) / <alpha-value>)",
  600: "rgb(var(--accent-600-rgb) / <alpha-value>)",
  700: "rgb(var(--accent-700-rgb) / <alpha-value>)",
  800: "rgb(var(--accent-800-rgb) / <alpha-value>)",
  900: "rgb(var(--accent-900-rgb) / <alpha-value>)",
  950: "rgb(var(--accent-950-rgb) / <alpha-value>)"
};

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Poppins'", "sans-serif"],
        body: ["'Inter'", "system-ui", "sans-serif"]
      },
      colors: {
        brand: {
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9"
        },
        violet: accentScale,
        purple: accentScale,
        indigo: accentScale,
        fuchsia: accentScale,
        pink: accentScale
      }
    }
  },
  plugins: []
};
