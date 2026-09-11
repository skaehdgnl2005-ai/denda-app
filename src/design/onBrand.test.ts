import { tokens } from './tokens';
import { onBrandVeil } from './onBrand';

describe('onBrandVeil — brand fill 위 콘텐츠용 반투명 on-brand 베일 (W3-4)', () => {
  it('light: on-brand(흰색) 기반 rgba', () => {
    expect(onBrandVeil(tokens.light, 0.72)).toBe('rgba(255, 255, 255, 0.72)');
  });

  it('dark: on-brand(근검정) 기반 rgba — 흰색 하드코딩 금지 (다크 brand fill 위 대비 확보)', () => {
    // 다크 on-brand = 근검정 → 다크 brand-500(밝은 보라) 위에서 대비. 흰색 rgba면 대비 무너짐.
    expect(onBrandVeil(tokens.dark, 0.72)).toBe('rgba(15, 15, 18, 0.72)');
  });

  it('alpha 1 → 불투명 on-brand 채널과 동일', () => {
    expect(onBrandVeil(tokens.light, 1)).toBe('rgba(255, 255, 255, 1)');
  });
});
