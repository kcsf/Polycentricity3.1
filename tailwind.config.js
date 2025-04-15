/** @type {import('tailwindcss').Config} */
const { skeleton } = require('@skeletonlabs/tw-plugin');

export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './node_modules/@skeletonlabs/skeleton/**/*.{html,js,svelte,ts}'
  ],
  theme: {
    extend: {},
    screens: {
      'sm': '640px',
      'md': '768px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
  },
  plugins: [
    skeleton({
      themes: { preset: ["skeleton", "modern", "crimson", "gold", "hamlindigo", "rocket", "seafoam", "vintage", "sahara", "halloween", "wintry"] }
    })
  ]
}