import { tokens } from './lib/tokens';

// Note: In Tailwind CSS v4, custom colors and spacing are configured directly in app/globals.css.
// This tailwind.config.ts file is maintained to ensure design token availability for secondary tooling and prevent spec drift.
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: tokens.light.brand,
        surface: tokens.light.surface,
        border: tokens.light.border,
        text: tokens.light.text,
        heat: tokens.light.heat,
        semantic: tokens.light.semantic,
      },
      spacing: tokens.space,
      borderRadius: tokens.radius,
    },
  },
};
