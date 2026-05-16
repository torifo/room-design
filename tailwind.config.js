/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        blueprint: "0 18px 55px rgba(31, 41, 55, 0.16)",
      },
    },
  },
  plugins: [],
};
