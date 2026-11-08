/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Audiowide"', 'cursive', 'sans-serif'],
        brand: ['"Audiowide"', 'cursive', 'sans-serif'],
        audiowide: ['"Audiowide"', 'cursive', 'sans-serif'],
        serif: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        sans: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        mono: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
