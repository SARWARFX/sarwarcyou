/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        sans: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        mono: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
