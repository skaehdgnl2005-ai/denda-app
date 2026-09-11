import { rowPressBg, ctaPressBg } from './press';
import { tokens } from './tokens';

// W2-8 — pressed 배경 순수 헬퍼 계약(§9.1 pressed=surface). light/dark 양쪽 검증.
describe('press helpers (W2-8)', () => {
  describe('rowPressBg — 행·카드', () => {
    it('pressed → surface-3 (light)', () => {
      expect(rowPressBg(true, tokens.light)).toBe(tokens.light.surface[3]);
    });
    it('pressed → surface-3 (dark)', () => {
      expect(rowPressBg(true, tokens.dark)).toBe(tokens.dark.surface[3]);
    });
    it('not pressed → 기본 transparent', () => {
      expect(rowPressBg(false, tokens.light)).toBe('transparent');
    });
    it('not pressed → 넘긴 base 배경 유지', () => {
      expect(rowPressBg(false, tokens.light, tokens.light.surface[1])).toBe(
        tokens.light.surface[1],
      );
    });
  });

  describe('ctaPressBg — brand fill CTA', () => {
    it('pressed → brand-600 (light, 진해짐)', () => {
      expect(ctaPressBg(true, tokens.light)).toBe(tokens.light.brand[600]);
    });
    it('pressed → brand-600 (dark, 밝아짐)', () => {
      expect(ctaPressBg(true, tokens.dark)).toBe(tokens.dark.brand[600]);
    });
    it('not pressed → brand-500 (light/dark)', () => {
      expect(ctaPressBg(false, tokens.light)).toBe(tokens.light.brand[500]);
      expect(ctaPressBg(false, tokens.dark)).toBe(tokens.dark.brand[500]);
    });
  });
});
