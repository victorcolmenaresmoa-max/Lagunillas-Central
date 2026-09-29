import type { Config } from 'tailwindcss';

/**
 * Paleta inspirada en Lagunillas:
 *  - cal:      paredes encaladas y papel cálido (fondo)
 *  - cielo:    el azul limpio del cielo andino
 *  - laguna:   el verde jade de la laguna reflejando las montañas
 *  - monte:    el verde de los cerros
 *  - ocre:     el amarillo de la iglesia
 *  - teja:     la base terracota de la iglesia y los techos
 *  - ocaso:    el atardecer dorado sobre el agua (ofertas flash)
 *  - tinta:    texto principal, verde-pizarra profundo
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cal: {
          50: '#fdfbf6',
          100: '#f8f3e8',
          200: '#efe7d6',
          300: '#e2d6bf',
        },
        tinta: {
          400: '#7c8a86',
          500: '#5b6b67',
          600: '#3f504c',
          700: '#2b3b38',
          900: '#172421',
        },
        cielo: {
          100: '#e3eff9',
          200: '#c3dcf1',
          400: '#6aa6dc',
          500: '#3d86c6',
          600: '#2c6ca6',
        },
        laguna: {
          50: '#eef7f2',
          100: '#d9eee4',
          200: '#b2dcc8',
          400: '#4fa889',
          500: '#2f8a6d',
          600: '#23705a',
          700: '#1b5646',
        },
        monte: {
          400: '#89a85a',
          500: '#6b8f43',
          600: '#557535',
        },
        ocre: {
          100: '#fbf1d3',
          200: '#f6e2a5',
          300: '#efcd6b',
          400: '#e6b83f',
          500: '#d49f25',
          600: '#b3811a',
        },
        teja: {
          100: '#f8e1d9',
          400: '#d9725a',
          500: '#c4553b',
          600: '#a4422c',
        },
        ocaso: {
          300: '#fbc766',
          400: '#f5a33e',
          500: '#e57a2e',
          600: '#c25a26',
          800: '#7a3420',
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif'],
        display: ["'Fraunces Variable'", 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23, 36, 33, 0.04), 0 8px 24px -12px rgba(23, 36, 33, 0.18)',
        lift: '0 2px 4px rgba(23, 36, 33, 0.05), 0 18px 40px -16px rgba(23, 36, 33, 0.28)',
        jade: '0 10px 28px -10px rgba(35, 112, 90, 0.55)',
        ocaso: '0 14px 36px -12px rgba(194, 90, 38, 0.55)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drift: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.8' },
        },
        glow: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.08)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.18)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-up': 'slide-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        drift: 'drift 60s linear infinite',
        shimmer: 'shimmer 3.5s ease-in-out infinite',
        glow: 'glow 4s ease-in-out infinite',
        pop: 'pop 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
