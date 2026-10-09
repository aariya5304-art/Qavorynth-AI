/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#070c18', 900: '#0b1322', 800: '#101b30', 700: '#182741', 600: '#22344f' },
        line: '#243653',
        fg: { DEFAULT: '#d8e1f1', muted: '#8193b0', dim: '#5d6f8c' },
        cyanx: { DEFAULT: '#3fd0e8', dim: '#1d7f90' },
        warn: '#f2b84b',
        crit: '#ef5b5b',
        safe: '#46c48a',
      },
      fontFamily: { sans: ['"Barlow Semi Condensed"', '"Segoe UI"', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
}
