// RN 색 문자열 → Figma RGB(0..1) + alpha 파서.
// 테스트 입력은 design-guard(D5) 준수를 위해 리터럴 hex 대신 tokens에서 가져온다.
import { tokens } from '@/design/tokens';
import { parseColor } from './color';

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.002;

describe('parseColor', () => {
  it('6자리 hex를 0..1 RGB로 변환한다', () => {
    // tokens.light.brand[500] = 보라 (124, 58, 237)
    const c = parseColor(tokens.light.brand[500]);
    expect(c).not.toBeNull();
    expect(near(c!.r, 124 / 255)).toBe(true);
    expect(near(c!.g, 58 / 255)).toBe(true);
    expect(near(c!.b, 237 / 255)).toBe(true);
    expect(c!.a).toBe(1);
  });

  it('흰색·검정 토큰을 정확히 변환한다', () => {
    const white = parseColor(tokens.light.surface[0]);
    expect(white).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    const ink = parseColor(tokens.light.text.primary);
    expect(near(ink!.r, 17 / 255)).toBe(true);
    expect(near(ink!.g, 24 / 255)).toBe(true);
    expect(near(ink!.b, 39 / 255)).toBe(true);
  });

  it('대소문자를 가리지 않는다', () => {
    const upper = parseColor(tokens.light.brand[500].toUpperCase());
    const lower = parseColor(tokens.light.brand[500].toLowerCase());
    expect(upper).toEqual(lower);
  });

  it('3자리 축약 hex를 확장한다', () => {
    expect(parseColor('#fff')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor('#000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('8자리 hex의 알파를 읽는다', () => {
    // 토큰에서 파생 — 리터럴 hex 회피
    const half = parseColor(`${tokens.light.brand[500]}80`);
    expect(half).not.toBeNull();
    expect(near(half!.a, 128 / 255)).toBe(true);
    expect(near(half!.r, 124 / 255)).toBe(true);
  });

  it('rgba() 문자열을 파싱한다 (다크 토큰이 이 형식)', () => {
    // tokens.dark.brand[50] = 'rgba(155, 122, 255, 0.06)'
    const c = parseColor(tokens.dark.brand[50]);
    expect(c).not.toBeNull();
    expect(near(c!.r, 155 / 255)).toBe(true);
    expect(near(c!.g, 122 / 255)).toBe(true);
    expect(near(c!.b, 255 / 255)).toBe(true);
    expect(near(c!.a, 0.06)).toBe(true);
  });

  it('scrim rgba의 알파를 보존한다', () => {
    const c = parseColor(tokens.light.overlay.scrim);
    expect(c).toEqual({ r: 0, g: 0, b: 0, a: 0.4 });
  });

  it('알파 없는 rgb()는 alpha=1', () => {
    const c = parseColor('rgb(255, 0, 0)');
    expect(c).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('공백이 없는 rgba도 파싱한다', () => {
    expect(parseColor('rgba(0,0,0,0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 });
  });

  it("'transparent'는 alpha 0으로 변환한다", () => {
    expect(parseColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it('기본 색 이름을 인식한다', () => {
    expect(parseColor('white')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(parseColor('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('처리 불가 입력은 null을 반환한다 (호출부가 fill 생략을 결정)', () => {
    expect(parseColor(undefined)).toBeNull();
    expect(parseColor(null)).toBeNull();
    expect(parseColor('')).toBeNull();
    expect(parseColor('nonsense-color')).toBeNull();
    expect(parseColor(12345)).toBeNull();
  });

  it('0..255 범위를 벗어난 rgba는 클램프한다', () => {
    const c = parseColor('rgba(300, -20, 128, 2)');
    expect(c).toEqual({ r: 1, g: 0, b: 128 / 255, a: 1 });
  });

  it('모든 라이트 토큰 색을 예외 없이 파싱한다', () => {
    const all = [
      ...Object.values(tokens.light.brand),
      ...Object.values(tokens.light.surface),
      ...Object.values(tokens.light.border),
      ...Object.values(tokens.light.text),
      ...tokens.light.heat,
      tokens.light.overlay.scrim,
    ];
    for (const v of all) {
      expect(parseColor(v)).not.toBeNull();
    }
  });

  it('모든 다크 토큰 색을 예외 없이 파싱한다 (rgba 혼재)', () => {
    const all = [
      ...Object.values(tokens.dark.brand),
      ...Object.values(tokens.dark.surface),
      ...Object.values(tokens.dark.border),
      ...Object.values(tokens.dark.text),
      ...tokens.dark.heat,
      tokens.dark.overlay.scrim,
    ];
    for (const v of all) {
      expect(parseColor(v)).not.toBeNull();
    }
  });
});
