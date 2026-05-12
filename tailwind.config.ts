import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#FFF8EC",
          100: "#FFEDDE",
          300: "#FFC299",
          500: "#FF7A45",
          700: "#B85420",
        },
        success: "#2BB673",
        warn:    "#FFC857",
        danger:  "#C73E2A",
        surface: "#F4F0E8",
        mute:    "#998566",
        body:    "#5C5852",
        ink:     "#1F1A12",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      fontSize: {
        eyebrow: ["10px", { letterSpacing: "0.12em", lineHeight: "1.2" }],
        phrase:  ["18px", { lineHeight: "1.4", letterSpacing: "0em" }],
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "6": "24px",
        "10": "40px",
      },
    },
  },
  plugins: [],
};

export default config;
