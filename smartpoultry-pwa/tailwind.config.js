/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
      },
      colors: {
        forest: {
          50:  '#f0f7f0',
          100: '#dceedd',
          200: '#b5dab7',
          300: '#84be88',
          400: '#529e58',
          500: '#2e7d34',
          600: '#1e5e23',
          700: '#174d1c',
          800: '#103a14',
          900: '#0a260d',
          950: '#061509',
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
        },
        cream: '#faf7f2',
      }
    },
  },
  plugins: [],
}
