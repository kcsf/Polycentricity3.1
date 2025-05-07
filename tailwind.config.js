/** @type {import('tailwindcss').Config} */
const { join } = require('path');
const { skeleton } = require('@skeletonlabs/tw-plugin');

module.exports = {
  darkMode: 'class',
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
    require('@tailwindcss/forms'),
    skeleton({
      themes: { preset: ["skeleton"] }
    })
  ],
  safelist: [
    'md:hidden',
    'md:block',
    'md:grid',
    'md:flex'
  ]
}