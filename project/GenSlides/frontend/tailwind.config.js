/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FFDE00',
        'text-primary': '#383838',
        'bg-light': '#F4EFEA',
      },
      fontFamily: {
        heading: ['Aeonik', 'Inter', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'hard': '-6px 6px 0px 0px #383838',
        'hard-sm': '-3px 3px 0px 0px #383838',
      },
      borderRadius: {
        'sm': '2px',
        'md': '10px',
      },
    },
  },
  plugins: [],
}
