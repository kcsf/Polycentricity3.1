/** @type {import('tailwindcss').Config} */
const { join } = require('path');
const { skeleton } = require('@skeletonlabs/tw-plugin');
const { fennecTheme } = require('./src/lib/theme/theme');

module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{html,js,svelte,ts}',
    join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}')
  ],
  theme: {
    extend: {},
  },
  plugins: [
    skeleton({
      themes: {
        custom: [
          fennecTheme
        ]
      }
    })
  ]
};