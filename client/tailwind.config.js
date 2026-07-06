/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // RGB-Tripel aus CSS-Variablen (Defaults in index.css) – so kann das
        // Branding pro Gastronom die Gast-Seiten umfärben.
        noir: 'rgb(var(--c-noir) / <alpha-value>)',
        carta: 'rgb(var(--c-carta) / <alpha-value>)',
        ivory: 'rgb(var(--c-ivory) / <alpha-value>)',
        champagne: 'rgb(var(--c-champagne) / <alpha-value>)',
        'champagne-dark': 'rgb(var(--c-champagne-dark) / <alpha-value>)',
        oliva: 'rgb(var(--c-oliva) / <alpha-value>)',
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
