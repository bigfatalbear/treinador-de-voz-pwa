/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070b16',
          900: '#0b1020',
          850: '#101731',
          800: '#151d3b',
          700: '#1e2a52'
        },
        brand: {
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5'
        },
        accent: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif']
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(129,140,248,.18), 0 18px 50px -20px rgba(79,70,229,.55)'
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' }
        }
      },
      animation: {
        pulseSoft: 'pulseSoft 2.4s ease-in-out infinite'
      }
    }
  },
  plugins: []
};
