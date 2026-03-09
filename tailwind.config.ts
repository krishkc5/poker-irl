import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#042013',
          800: '#0b3f2a',
          700: '#126840',
        },
      },
      boxShadow: {
        table: '0 22px 55px -30px rgba(6, 78, 59, 0.9)',
      },
      fontFamily: {
        sans: ['"Manrope"', '"Segoe UI"', 'sans-serif'],
      },
      backgroundImage: {
        grain:
          'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)',
      },
    },
  },
  plugins: [],
}

export default config
