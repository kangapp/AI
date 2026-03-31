/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // MotherDuck 风格配色 - 从 motherduck.com 提取
        primary: {
          DEFAULT: '#FFDE00',
          50: '#FFFDE7',
          100: '#FFF9C4',
          200: '#FFEE58',
          300: '#FFD54F',
          400: '#FFCA28',
          500: '#FFD200',
          600: '#E6BB00',
          700: '#CCA000',
          800: '#B38600',
          900: '#996D00',
        },
        secondary: {
          50: '#E3F2FD',
          100: '#BBDEFB',
          200: '#90CAF9',
          300: '#64B5F6',
          400: '#42A5F5',
          500: '#6FC2FF',
          600: '#5BA8E6',
          700: '#4A91C9',
          800: '#3A7AAB',
          900: '#2D648E',
        },
        accent: '#6FC2FF',
        background: '#F4EFEA',
        surface: '#F8F8F7',
        'text-primary': '#383838',
        'text-secondary': '#818181',
        border: '#84A6BC',
        // Dark theme colors
        'dark-bg': '#1A1A1A',
        'dark-surface': '#2D2D2D',
        'dark-text': '#F4EFEA',
        'dark-text-secondary': '#A0A0A0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Aeonik Mono', 'SF Mono', 'Consolas', 'monospace'],
        display: ['Aeonik', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '10px',
        lg: '50%',
      },
      boxShadow: {
        'hard': '-6px 6px 0px 0px #383838',
        'soft': '0 4px 8px 0px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};