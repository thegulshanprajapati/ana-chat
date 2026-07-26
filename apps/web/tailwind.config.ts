import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      boxShadow: {
        glass: "0 20px 80px rgba(15, 23, 42, 0.15)"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;
