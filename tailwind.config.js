/** @type {import('tailwindcss').Config} */
const { join } = require('path');

module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8f6f4',
          100: '#e3d5cd',
          200: '#d4bba8',
          300: '#c5a183',
          400: '#b5865e',
          500: '#a66a5e',
          600: '#9c6156',
          700: '#8d574e',
          800: '#7f4e46',
          900: '#70443e',
          950: '#613a36',
        },
        secondary: {
          50: '#d6e8de',
          100: '#c8e0d2',
          200: '#b9d8c7',
          300: '#abd0bb',
          400: '#9cc9b0',
          500: '#8ec1a4',
          600: '#7fb999',
          700: '#71b18d',
          800: '#63a982',
          900: '#5a7a67',
        }
      }
    },
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [
    require('@tailwindcss/forms')
  ],
  safelist: [
    'md:hidden',
    'md:block',
    'md:grid',
    'md:flex',
    'lg:hidden',
    'lg:block',
    'lg:grid',
    'lg:flex'
  ]
}