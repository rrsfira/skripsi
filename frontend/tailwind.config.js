/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/react-tailwindcss-datepicker/dist/index.esm.js"
  ],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/typography"), require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#F58220",
          "primary-focus": "#FF9F40",
          "primary-content": "#FFFFFF",

          secondary: "#4F4F4F",
          "secondary-focus": "#333333",
          "secondary-content": "#FFFFFF",

          accent: "#FFB066",
          "accent-focus": "#FF9F40",
          "accent-content": "#333333",

          neutral: "#333333",
          "neutral-focus": "#4F4F4F",
          "neutral-content": "#FFFFFF",

          "base-100": "#FFFFFF",
          "base-200": "#F5F5F5",
          "base-300": "#FAFAFA",
          "base-content": "#333333",

          info: "#3498DB",
          success: "#2ECC71",
          warning: "#FFB020",
          error: "#E74C3C",
        },
      },
      {
        dark: {
          primary: "#F58220",
          "primary-focus": "#FF9F40",
          "primary-content": "#FFFFFF",

          secondary: "#E0E0E0",
          "secondary-focus": "#FFFFFF",
          "secondary-content": "#1E1E1E",

          accent: "#FFB066",
          "accent-focus": "#FF9F40",
          "accent-content": "#1E1E1E",

          neutral: "#4F4F4F",
          "neutral-focus": "#333333",
          "neutral-content": "#FFFFFF",

          "base-100": "#1E1E1E",
          "base-200": "#2D2D2D",
          "base-300": "#333333",
          "base-content": "#FFFFFF",

          info: "#2980B9",
          success: "#27AE60",
          warning: "#F39C12",
          error: "#E74C3C",
        },
      },
    ],
  },

}
