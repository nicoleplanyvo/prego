/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noir: '#0B0A08',
        carta: '#161410',
        ivory: '#F2EDE3',
        champagne: '#C9A96A',
        'champagne-dark': '#B08F4F',
        oliva: '#9CB89C',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      letterSpacing: {
        luxe: '0.3em',
      },
    },
  },
  plugins: [],
};
