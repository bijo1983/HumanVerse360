/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fdfaf0', 100: '#faf3d0', 200: '#f4e59e', 300: '#edd165',
          400: '#e4bc3a', 500: '#D4AF37', 600: '#b8952a', 700: '#95761f',
          800: '#755c18', 900: '#5c4912', 950: '#3a2d09',
        },
        secondary: {
          50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
          400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#374151',
          800: '#1f2937', 900: '#111827', 950: '#030712',
        },
        accent: {
          50: '#ecfdf5', 100: '#d1fae5', 400: '#34d399',
          500: '#10b981', 600: '#059669', 700: '#047857',
        },
        success: { 50: '#f0fdf4', 100: '#dcfce7', 500: '#22c55e', 600: '#16a34a', 700: '#15803d' },
        warning: { 50: '#fffbeb', 100: '#fef3c7', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        error:   { 50: '#fef2f2', 100: '#fee2e2', 500: '#ef4444', 600: '#dc2626', 700: '#b91c1c' },
        gold: {
          50: '#fdfaf0', 100: '#faf3d0', 200: '#f4e59e', 300: '#edd165',
          400: '#e4bc3a', 500: '#D4AF37', 600: '#b8952a', 700: '#95761f',
          800: '#755c18', 900: '#5c4912',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'slide-in': 'slideIn 0.25s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
        slideIn: { from: { transform: 'translateX(-8px)', opacity: '0' }, to: { transform: 'translateX(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};
