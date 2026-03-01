/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        quantum: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        neon: {
          blue: '#00d4ff',
          purple: '#8b5cf6',
          pink: '#ec4899',
          green: '#10b981',
          yellow: '#f59e0b',
          orange: '#f97316',
          red: '#ef4444',
        },
        surface: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
        neumorph: {
          base: '#1a1f2e',
          light: '#242b3d',
          dark: '#12161f',
        },
      },
      boxShadow: {
        'neumorph-xs': '2px 2px 4px rgba(0,0,0,0.35), -2px -2px 4px rgba(255,255,255,0.02)',
        'neumorph-sm': '3px 3px 6px rgba(0,0,0,0.4), -3px -3px 6px rgba(255,255,255,0.03)',
        'neumorph-md': '6px 6px 12px rgba(0,0,0,0.4), -6px -6px 12px rgba(255,255,255,0.03)',
        'neumorph-lg': '10px 10px 20px rgba(0,0,0,0.4), -10px -10px 20px rgba(255,255,255,0.03)',
        'neumorph-xl': '15px 15px 30px rgba(0,0,0,0.4), -15px -15px 30px rgba(255,255,255,0.03)',
        'neumorph-inset-xs': 'inset 2px 2px 4px rgba(0,0,0,0.35), inset -2px -2px 4px rgba(255,255,255,0.02)',
        'neumorph-inset-sm': 'inset 3px 3px 6px rgba(0,0,0,0.4), inset -3px -3px 6px rgba(255,255,255,0.03)',
        'neumorph-inset-md': 'inset 6px 6px 12px rgba(0,0,0,0.4), inset -6px -6px 12px rgba(255,255,255,0.03)',
        'neumorph-pressed': 'inset 4px 4px 8px rgba(0,0,0,0.5), inset -4px -4px 8px rgba(255,255,255,0.02)',
        'neumorph-pressed-sm': 'inset 2px 2px 4px rgba(0,0,0,0.45), inset -2px -2px 4px rgba(255,255,255,0.02)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Space Grotesk', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'orbit': 'orbit 8s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(14, 165, 233, 0.5), 0 0 10px rgba(14, 165, 233, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(14, 165, 233, 0.8), 0 0 30px rgba(14, 165, 233, 0.5)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(30px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(30px) rotate(-360deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
      },
    },
  },
  plugins: [],
}
