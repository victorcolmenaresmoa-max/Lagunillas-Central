import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#090d16',
          900: '#0e1422',
          850: '#121a2b',
          800: '#172035',
        },
        laguna: {
          300: '#7ef0e0',
          400: '#3ee2cc',
          500: '#14c7b2',
          600: '#0ea393',
        },
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans Variable'", 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 10px 40px -10px rgba(20, 199, 178, 0.45)',
        'glow-hot': '0 10px 40px -8px rgba(251, 113, 60, 0.55)',
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
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(251, 113, 60, 0.6)' },
          '100%': { boxShadow: '0 0 0 12px rgba(251, 113, 60, 0)' },
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
        shimmer: 'shimmer 3s linear infinite',
        'pulse-ring': 'pulse-ring 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        pop: 'pop 0.25s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
