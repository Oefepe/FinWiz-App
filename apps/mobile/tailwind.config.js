/** @type {import('tailwindcss').Config} */
const tokens = require('./theme/tokens.js');

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.tsx', './hooks/**/*.ts'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: tokens,
    },
  },
  plugins: [],
};
