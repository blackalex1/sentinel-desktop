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
        background: '#06060a',
        surface: {
          DEFAULT: '#0d0d15',
          elevated: '#131320',
          border: 'rgba(255, 255, 255, 0.08)',
          highlight: 'rgba(255, 255, 255, 0.12)',
        },
        accent: {
          emerald: '#10b981',
          cyan: '#06b6d4',
          violet: '#8b5cf6',
          rose: '#f43f5e',
          amber: '#f59e0b',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['Fira Code', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-emerald': '0 0 40px -10px rgba(16, 185, 129, 0.4), 0 0 20px -5px rgba(16, 185, 129, 0.2)',
        'glow-cyan': '0 0 40px -10px rgba(6, 182, 212, 0.4), 0 0 20px -5px rgba(6, 182, 212, 0.2)',
        'glow-violet': '0 0 40px -10px rgba(139, 92, 246, 0.4), 0 0 20px -5px rgba(139, 92, 246, 0.2)',
        'glow-rose': '0 0 40px -10px rgba(244, 63, 94, 0.4), 0 0 20px -5px rgba(244, 63, 94, 0.2)',
        'double-bezel': 'inset 0 1px 1px rgba(255, 255, 255, 0.15), 0 10px 30px -10px rgba(0, 0, 0, 0.8)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 12s linear infinite',
        'radar-ping': 'radarPing 2.5s cubic-bezier(0, 0, 0.2, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        radarPing: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
