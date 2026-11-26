/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        hust: {
          red: '#B71C1C',
          crimson: '#C8102E',
          dark: '#880E1E',
          light: '#FDECEC',
        },
        radar: {
          navy: '#0F172A',
          slate: '#1E293B',
          blue: '#2563EB',
          teal: '#0D9488',
          amber: '#D97706',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
