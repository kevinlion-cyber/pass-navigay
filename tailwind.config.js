/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7B2D8B',
          light: '#f3e8f8',
          dark: '#2d0d3d',
        },
        success: '#1a7a3a',
        alert: '#c0392b',
        sponsor: '#d4a017',
        dark: {
          bg: '#0e0e12',
          surface: '#16161f',
          border: '#2a2a35',
        },
        light: {
          bg: '#f7f5f0',
          surface: '#ffffff',
          border: '#e5e0da',
        },
      },
      borderRadius: {
        card: '12px',
        pill: '20px',
        input: '8px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
