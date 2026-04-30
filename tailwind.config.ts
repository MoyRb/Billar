import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        rack: {
          obsidian: '#101715',
          shell: '#1a2421',
          panel: '#22312d',
          felt: '#174737',
          cream: '#f3ead8',
          gold: '#b8955d',
          'wood-dark': '#2f251a',
        },
      },
      boxShadow: {
        rack: '0 10px 30px rgba(0,0,0,0.30)',
        'rack-lg': '0 16px 38px rgba(0,0,0,0.40)',
        'inner-felt': 'inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -8px 20px rgba(0,0,0,0.24)',
      },
      backgroundImage: {
        'radial-rack': 'radial-gradient(circle at 15% 15%, rgba(184,149,93,0.18), transparent 35%), radial-gradient(circle at 85% 0%, rgba(23,71,55,0.4), transparent 40%)',
        grain: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
      },
      backgroundSize: {
        grain: '3px 3px, 3px 3px',
      },
    },
  },
  plugins: [],
};

export default config;
