/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rajdhani', 'sans-serif'],
        rajdhani: ['Rajdhani', 'sans-serif'],
        brand: ['Orbitron', 'sans-serif'],
        futuristic: ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
