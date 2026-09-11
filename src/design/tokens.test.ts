import { tokens } from './tokens';

// Helper to parse hex colors or rgba colors and calculate relative luminance.
function parseColor(colorStr: string): { r: number; g: number; b: number; a: number } {
  const trimmed = colorStr.trim().toLowerCase();

  if (trimmed.startsWith('#')) {
    const hex = trimmed.substring(1);
    if (hex.length === 3) {
      const r = parseInt((hex[0] || '0') + (hex[0] || '0'), 16);
      const g = parseInt((hex[1] || '0') + (hex[1] || '0'), 16);
      const b = parseInt((hex[2] || '0') + (hex[2] || '0'), 16);
      return { r, g, b, a: 1 };
    } else if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return { r, g, b, a: 1 };
    } else if (hex.length === 8) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const a = parseInt(hex.substring(6, 8), 16) / 255;
      return { r, g, b, a };
    }
  } else if (trimmed.startsWith('rgba')) {
    const parts = trimmed
      .replace(/rgba?\(|\)/g, '')
      .split(',')
      .map((x) => x.trim());
    return {
      r: parseInt(parts[0] || '0', 10),
      g: parseInt(parts[1] || '0', 10),
      b: parseInt(parts[2] || '0', 10),
      a: parts[3] !== undefined ? parseFloat(parts[3]) : 1,
    };
  } else if (trimmed.startsWith('rgb')) {
    const parts = trimmed
      .replace(/rgb\(|\)/g, '')
      .split(',')
      .map((x) => x.trim());
    return {
      r: parseInt(parts[0] || '0', 10),
      g: parseInt(parts[1] || '0', 10),
      b: parseInt(parts[2] || '0', 10),
      a: 1,
    };
  }

  throw new Error(`Unsupported color format: ${colorStr}`);
}

function blend(fgStr: string, bgStr: string): string {
  const fg = parseColor(fgStr);
  const bg = parseColor(bgStr);

  if (fg.a === 1) {
    return fgStr;
  }

  const r = Math.round(fg.r * fg.a + bg.r * (1 - fg.a));
  const g = Math.round(fg.g * fg.a + bg.g * (1 - fg.a));
  const b = Math.round(fg.b * fg.a + bg.b * (1 - fg.a));

  return `rgb(${r}, ${g}, ${b})`;
}

function getLuminance(colorStr: string): number {
  const color = parseColor(colorStr);
  const r = color.r / 255;
  const g = color.g / 255;
  const b = color.b / 255;

  const R = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
  const G = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
  const B = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);

  const brighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (brighter + 0.05) / (darker + 0.05);
}

describe('Design System Tokens', () => {
  test('Light and Dark color tokens should have matching key structures', () => {
    const lightColors = tokens.light;
    const darkColors = tokens.dark;

    const compareKeys = (
      obj1: Record<string, unknown>,
      obj2: Record<string, unknown>,
      path = '',
    ) => {
      const keys1 = Object.keys(obj1).sort();
      const keys2 = Object.keys(obj2).sort();

      expect(keys1).toEqual(keys2);

      keys1.forEach((key) => {
        const val1 = obj1[key];
        const val2 = obj2[key];
        const currentPath = path ? `${path}.${key}` : key;

        if (val1 && typeof val1 === 'object' && !Array.isArray(val1)) {
          expect(typeof val2).toBe('object');
          compareKeys(
            val1 as Record<string, unknown>,
            val2 as Record<string, unknown>,
            currentPath,
          );
        } else if (Array.isArray(val1)) {
          expect(Array.isArray(val2)).toBe(true);
          expect((val1 as unknown[]).length).toBe((val2 as unknown[]).length);
        } else {
          expect(typeof val2).not.toBe('object');
        }
      });
    };

    compareKeys(
      lightColors as unknown as Record<string, unknown>,
      darkColors as unknown as Record<string, unknown>,
    );
  });

  test('Core text-to-background combinations should satisfy WCAG AA contrast ratio (>= 4.5:1)', () => {
    // 1. Light Mode Contrast Checks
    const lightTextPrimary: string = tokens.light.text.primary;
    const lightTextSecondary: string = tokens.light.text.secondary;
    const lightTextTertiary: string = tokens.light.text.tertiary;
    const lightSurface0: string = tokens.light.surface[0];
    const lightTextOnBrand: string = tokens.light.text['on-brand'];
    const lightBrand500: string = tokens.light.brand[500];

    // text-primary on surface-0 (Light) -> Target >= 4.5:1
    const contrastLightPrimary = getContrastRatio(lightTextPrimary, lightSurface0);
    expect(contrastLightPrimary).toBeGreaterThanOrEqual(4.5);

    // text-secondary on surface-0 (Light) -> Target >= 4.5:1
    const contrastLightSecondary = getContrastRatio(lightTextSecondary, lightSurface0);
    expect(contrastLightSecondary).toBeGreaterThanOrEqual(4.5);

    // text-tertiary on surface-0 (Light) -> Target >= 4.5:1
    const contrastLightTertiary = getContrastRatio(lightTextTertiary, lightSurface0);
    expect(contrastLightTertiary).toBeGreaterThanOrEqual(4.5);

    // text-on-brand on brand-500 (Light) -> Target >= 4.5:1 (actually 5.9:1)
    const contrastLightOnBrand = getContrastRatio(lightTextOnBrand, lightBrand500);
    expect(contrastLightOnBrand).toBeGreaterThanOrEqual(4.5);

    // 2. Dark Mode Contrast Checks
    const darkTextPrimary: string = tokens.dark.text.primary;
    const darkTextSecondary: string = tokens.dark.text.secondary;
    const darkSurface0: string = tokens.dark.surface[0];
    const darkTextOnBrand: string = tokens.dark.text['on-brand'];
    const darkBrand500: string = tokens.dark.brand[500];

    // text-primary on surface-0 (Dark) -> Target >= 4.5:1
    const contrastDarkPrimary = getContrastRatio(darkTextPrimary, darkSurface0);
    expect(contrastDarkPrimary).toBeGreaterThanOrEqual(4.5);

    // text-secondary on surface-0 (Dark) -> Target >= 4.5:1 (using blended or raw)
    const contrastDarkSecondary = getContrastRatio(darkTextSecondary, darkSurface0);
    expect(contrastDarkSecondary).toBeGreaterThanOrEqual(4.5);

    // text-on-brand on brand-500 (Dark) -> Target >= 4.5:1 (actually 7.8:1)
    // Note: in dark mode, brand-500 is lighter and text-on-brand is dark (see tokens.dark)
    const blendedTextOnBrand = blend(darkTextOnBrand, darkBrand500);
    const contrastDarkOnBrand = getContrastRatio(blendedTextOnBrand, darkBrand500);
    expect(contrastDarkOnBrand).toBeGreaterThanOrEqual(4.5);
  });
});

describe('overlay 토큰 (W0-8 — 바텀시트/모달 backdrop)', () => {
  test('scrim backdrop이 light/dark 모두 rgba로 정의된다', () => {
    expect(tokens.light.overlay.scrim).toMatch(/^rgba\(/);
    expect(tokens.dark.overlay.scrim).toMatch(/^rgba\(/);
  });

  test('scrim은 반투명하다 (alpha < 1) — 뒤 콘텐츠가 비쳐야 함', () => {
    expect(parseColor(tokens.light.overlay.scrim).a).toBeLessThan(1);
    expect(parseColor(tokens.light.overlay.scrim).a).toBeGreaterThan(0);
    expect(parseColor(tokens.dark.overlay.scrim).a).toBeLessThan(1);
  });

  test('다크 scrim이 라이트보다 진하다 (다크 배경 위 시트 분리)', () => {
    expect(parseColor(tokens.dark.overlay.scrim).a).toBeGreaterThanOrEqual(
      parseColor(tokens.light.overlay.scrim).a,
    );
  });
});
