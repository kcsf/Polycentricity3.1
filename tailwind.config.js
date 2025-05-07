/** @type {import('tailwindcss').Config} */
const { join } = require('path');
const { skeleton } = require('@skeletonlabs/tw-plugin');

module.exports = {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}')
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
      themes: { preset: ["skeleton"] }
    })
  ],
}