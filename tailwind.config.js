/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Use class strategy for dark mode instead of media queries
  content: ['./src/**/*.{html,js,svelte,ts}', './src/lib/components/**/*.svelte'],
  theme: {
    extend: {},
  },
  plugins: [],
}