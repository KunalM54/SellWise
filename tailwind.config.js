/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sky: {
          DEFAULT: '#3B82F6',
          bright: '#60A5FA',
          deep: '#1D4ED8',
          soft: '#DBEAFE',
        },
        sun: {
          DEFAULT: '#FBBF24',
          bright: '#FCD34D',
          deep: '#D97706',
        },
        leaf: {
          DEFAULT: '#22C55E',
          soft: '#DCFCE7',
          deep: '#16A34A',
        },
        coral: {
          DEFAULT: '#F87171',
          soft: '#FEE2E2',
        },
        berry: {
          DEFAULT: '#A855F7',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          elevated: '#FFFFFF',
          sunken: '#F1F5F9',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted: '#475569',
          subtle: '#94A3B8',
          faint: '#CBD5E1',
        },
        outline: {
          DEFAULT: '#E2E8F0',
          strong: '#94A3B8',
        }
      },
      borderRadius: {
        'button': '16px',
        'card': '20px',
        'panel': '28px',
      },
      boxShadow: {
        'soft': '0 8px 24px rgba(15, 23, 42, 0.06)',
        'sky-glow': '0 12px 32px rgba(59, 130, 246, 0.15)',
        'modal': '0 24px 48px rgba(15, 23, 42, 0.12)',
        'sun-glow': '0 0 24px rgba(252, 211, 77, 0.4)',
      },
      fontFamily: {
        sans: ['"Atkinson Hyperlegible"', 'Inter', 'Nunito Sans', 'sans-serif'],
        display: ['"Hubot Sans"', 'Nunito', 'Quicksand', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
};
