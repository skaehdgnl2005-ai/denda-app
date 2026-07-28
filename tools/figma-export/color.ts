// RN 색 문자열 → Figma RGB 파서.
// Figma는 r/g/b를 0..1로 받고 alpha는 별도 필드(fill.opacity)로 분리한다.
// 이 프로젝트 토큰은 hex(라이트)와 rgba()(다크)가 섞여 있으므로 둘 다 필수 지원. → tokens.ts

/** Figma 스타일 색. r·g·b·a 모두 0..1. */
export interface ParsedColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** RN이 허용하는 CSS 색 이름 중 이 코드베이스에서 실제로 쓰일 만한 최소 집합. */
const NAMED: Record<string, [number, number, number]> = {
  transparent: [0, 0, 0],
  white: [255, 255, 255],
  black: [0, 0, 0],
  red: [255, 0, 0],
  green: [0, 128, 0],
  blue: [0, 0, 255],
  gray: [128, 128, 128],
  grey: [128, 128, 128],
};

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

const byte = (n: number): number => clamp01(n / 255);

function fromHex(hex: string): ParsedColor | null {
  const h = hex.slice(1);
  const isHex = /^[0-9a-fA-F]+$/.test(h);
  if (!isHex) return null;

  let r: number;
  let g: number;
  let b: number;
  let a = 255;

  // charAt은 범위를 벗어나도 ''를 반환한다 (noUncheckedIndexedAccess 회피).
  const ch = (i: number): string => h.charAt(i);

  if (h.length === 3 || h.length === 4) {
    r = parseInt(ch(0) + ch(0), 16);
    g = parseInt(ch(1) + ch(1), 16);
    b = parseInt(ch(2) + ch(2), 16);
    if (h.length === 4) a = parseInt(ch(3) + ch(3), 16);
  } else if (h.length === 6 || h.length === 8) {
    r = parseInt(h.slice(0, 2), 16);
    g = parseInt(h.slice(2, 4), 16);
    b = parseInt(h.slice(4, 6), 16);
    if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
  } else {
    return null;
  }

  return { r: byte(r), g: byte(g), b: byte(b), a: byte(a) };
}

function fromFunctional(input: string): ParsedColor | null {
  const m = /^rgba?\(([^)]+)\)$/i.exec(input);
  if (!m) return null;

  const parts = (m[1] ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length !== 3 && parts.length !== 4) return null;

  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const at = (i: number): number => nums[i] ?? 0;

  return {
    r: byte(at(0)),
    g: byte(at(1)),
    b: byte(at(2)),
    a: parts.length === 4 ? clamp01(at(3)) : 1,
  };
}

/**
 * RN 스타일의 색 값을 Figma RGB로 변환한다.
 * 해석 불가하면 null — 호출부가 "fill을 아예 넣지 않는다"를 선택할 수 있게 한다
 * (검정으로 폴백하면 조용히 틀린 디자인이 나오므로 금지).
 */
export function parseColor(input: unknown): ParsedColor | null {
  if (typeof input !== 'string') return null;

  const v = input.trim().toLowerCase();
  if (v.length === 0) return null;

  if (v === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const named = NAMED[v];
  if (named) return { r: byte(named[0]), g: byte(named[1]), b: byte(named[2]), a: 1 };

  if (v.startsWith('#')) return fromHex(v);
  if (v.startsWith('rgb')) return fromFunctional(v);

  return null;
}

/** Figma SOLID fill 형태로 변환. alpha가 0이면 null (fill 생략 신호). */
export function toSolidPaint(
  input: unknown,
): { type: 'SOLID'; color: { r: number; g: number; b: number }; opacity: number } | null {
  const c = parseColor(input);
  if (!c || c.a === 0) return null;
  return { type: 'SOLID', color: { r: c.r, g: c.g, b: c.b }, opacity: c.a };
}
