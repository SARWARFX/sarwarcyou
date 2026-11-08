/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Google Sans"', '"Product Sans"', 'sans-serif'],
        display: ['"Google Sans"', '"Product Sans"', 'sans-serif'],
        brand: ['"Google Sans"', '"Product Sans"', 'sans-serif'],
        audiowide: ['"Audiowide"', 'cursive', 'sans-serif'],
        serif: ['"Google Sans"', '"Product Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
