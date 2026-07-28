// RN 스타일 → Figma Auto Layout 매핑.
//
// Figma Plugin API 사실은 @figma/plugin-typings 1.131.0 원문 대조로 확정했다:
//  - counterAxisAlignItems: 'MIN'|'MAX'|'CENTER'|'BASELINE'  ← STRETCH 없음
//  - primaryAxisAlignItems: 'MIN'|'MAX'|'CENTER'|'SPACE_BETWEEN'  ← SPACE_AROUND/EVENLY 없음
//  - layoutGrow: 0 또는 1만
//  - DropShadowEffect: visible·blendMode 필수
//  - SolidPaint.color는 RGB(알파 없음) — 알파는 opacity로
//
// 설계 원칙: 표현 못 하는 것은 조용히 근사하지 않는다. 항상 warning을 남기고
// 플러그인이 레이어명에 ⚠️를 붙여 Figma 캔버스에서 눈에 띄게 한다.

import { toSolidPaint, parseColor } from './color';
import {
  defaultLayout,
  defaultBox,
  type IRLayout,
  type IRBox,
  type IRTextStyle,
  type IRAbsolute,
} from './ir';

export type FlatStyle = Record<string, unknown>;

export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface LayoutResult {
  layout: IRLayout;
  /** RN alignItems:'stretch'(기본값 포함) — Figma에선 자식의 layoutAlign으로 내려야 한다. */
  childrenStretch: boolean;
  warnings: string[];
}

export interface BoxResult {
  box: IRBox;
  warnings: string[];
}

export interface TextResult {
  text: IRTextStyle;
  warnings: string[];
}

/** expo-font 등록 키 → Figma/OS 실제 폰트명. */
const FAMILY_ALIAS: Record<string, string> = {
  PretendardVariable: 'Pretendard Variable',
};

/** 우리가 실제로 번역할 수 있는 속성. 여기 없는 게 나오면 경고한다. */
const SUPPORTED = new Set([
  // 레이아웃
  'flexDirection',
  'justifyContent',
  'alignItems',
  'alignSelf',
  'alignContent',
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'flexWrap',
  'gap',
  'rowGap',
  'columnGap',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'paddingStart',
  'paddingEnd',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'marginStart',
  'marginEnd',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'zIndex',
  'display',
  'overflow',
  // 박스
  'backgroundColor',
  'opacity',
  'borderWidth',
  'borderColor',
  'borderRadius',
  'borderStyle',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomLeftRadius',
  'borderBottomRightRadius',
  'shadowColor',
  'shadowOffset',
  'shadowOpacity',
  'shadowRadius',
  'elevation',
  // 텍스트
  'color',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'textAlignVertical',
  'textDecorationLine',
  'textTransform',
  'includeFontPadding',
]);

/**
 * iOS shadowRadius(블러 반경) → Figma effect radius 근사 배율.
 * 1:1이 아니며 실측 캘리브레이션 대상. 상수로 둬서 한 곳에서 조정 가능하게 한다.
 */
const SHADOW_RADIUS_SCALE = 2;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** RN 스타일 배열(중첩·null 포함)을 단일 객체로 접는다. 함수 스타일은 해석 불가라 버린다. */
export function flattenStyle(style: unknown): FlatStyle {
  const out: FlatStyle = {};
  const visit = (s: unknown): void => {
    if (!s) return;
    if (Array.isArray(s)) {
      for (const item of s) visit(item);
      return;
    }
    if (typeof s !== 'object') return;
    Object.assign(out, s as FlatStyle);
  };
  visit(style);
  return out;
}

/** RN box-model 우선순위: 구체 > 축 > 전체. */
function resolveEdges(s: FlatStyle, prefix: 'padding' | 'margin'): Edges {
  const all = num(s[prefix]) ?? 0;
  const h = num(s[`${prefix}Horizontal`]) ?? all;
  const v = num(s[`${prefix}Vertical`]) ?? all;
  return {
    top: num(s[`${prefix}Top`]) ?? v,
    right: num(s[`${prefix}Right`]) ?? num(s[`${prefix}End`]) ?? h,
    bottom: num(s[`${prefix}Bottom`]) ?? v,
    left: num(s[`${prefix}Left`]) ?? num(s[`${prefix}Start`]) ?? h,
  };
}

export function extractMargin(s: FlatStyle): Edges {
  return resolveEdges(s, 'margin');
}

function resolveSizing(
  raw: unknown,
  axis: 'width' | 'height',
  warnings: string[],
): number | 'FILL' | 'HUG' {
  const n = num(raw);
  if (n !== null) return n;
  if (raw === '100%') return 'FILL';
  if (typeof raw === 'string' && raw.endsWith('%')) {
    warnings.push(
      `퍼센트 ${axis} "${raw}"는 Figma Auto Layout에 대응물이 없어 HUG로 대체했습니다.`,
    );
    return 'HUG';
  }
  return 'HUG';
}

function resolveAbsolute(s: FlatStyle, warnings: string[]): IRAbsolute | undefined {
  if (s.position !== 'absolute') return undefined;

  const top = num(s.top);
  const right = num(s.right);
  const bottom = num(s.bottom);
  const left = num(s.left);

  const horizontal: IRAbsolute['horizontal'] =
    left !== null && right !== null ? 'STRETCH' : right !== null ? 'MAX' : 'MIN';
  const vertical: IRAbsolute['vertical'] =
    top !== null && bottom !== null ? 'STRETCH' : bottom !== null ? 'MAX' : 'MIN';

  // 부모 크기를 모르면 MAX 앵커의 실제 좌표를 계산할 수 없다 (테스트 렌더러엔 측정치가 없다).
  if (horizontal === 'MAX' || vertical === 'MAX') {
    warnings.push(
      '절대 배치가 right/bottom 기준입니다. 부모 크기를 알 수 없어 좌표는 Figma에서 확인이 필요합니다.',
    );
  }

  const out: IRAbsolute = { horizontal, vertical };
  if (top !== null) out.top = top;
  if (right !== null) out.right = right;
  if (bottom !== null) out.bottom = bottom;
  if (left !== null) out.left = left;
  return out;
}

function warnUnsupported(s: FlatStyle, warnings: string[]): void {
  for (const key of Object.keys(s)) {
    if (!SUPPORTED.has(key)) {
      warnings.push(`미지원 스타일 속성 "${key}" — Figma로 옮기지 않았습니다.`);
    }
  }
}

export function toLayout(style: unknown): LayoutResult {
  const s = flattenStyle(style);
  const warnings: string[] = [];
  const layout = defaultLayout();

  warnUnsupported(s, warnings);

  // 방향 — RN 기본은 column.
  const dir = s.flexDirection;
  if (dir === 'row' || dir === 'row-reverse') layout.mode = 'HORIZONTAL';
  else layout.mode = 'VERTICAL';
  if (dir === 'row-reverse' || dir === 'column-reverse') {
    warnings.push(`${String(dir)}는 Figma에 대응물이 없어 정방향으로 옮겼습니다.`);
  }

  // 주축 정렬.
  switch (s.justifyContent) {
    case 'center':
      layout.primaryAxisAlignItems = 'CENTER';
      break;
    case 'flex-end':
      layout.primaryAxisAlignItems = 'MAX';
      break;
    case 'space-between':
      layout.primaryAxisAlignItems = 'SPACE_BETWEEN';
      break;
    case 'space-around':
    case 'space-evenly':
      layout.primaryAxisAlignItems = 'SPACE_BETWEEN';
      warnings.push(
        `justifyContent "${String(s.justifyContent)}"는 Figma에 없어 space-between으로 근사했습니다.`,
      );
      break;
    default:
      layout.primaryAxisAlignItems = 'MIN';
  }

  // 교차축 정렬 — stretch는 Figma에서 부모 값이 아니라 자식 속성이다.
  const align = s.alignItems;
  let childrenStretch = false;
  switch (align) {
    case 'center':
      layout.counterAxisAlignItems = 'CENTER';
      break;
    case 'flex-end':
      layout.counterAxisAlignItems = 'MAX';
      break;
    case 'flex-start':
      layout.counterAxisAlignItems = 'MIN';
      break;
    case 'baseline':
      if (layout.mode === 'HORIZONTAL') {
        layout.counterAxisAlignItems = 'BASELINE';
      } else {
        layout.counterAxisAlignItems = 'MIN';
        warnings.push(
          '세로 방향의 alignItems:"baseline"은 Figma가 지원하지 않아 MIN으로 대체했습니다.',
        );
      }
      break;
    case 'stretch':
    case undefined:
      // RN 기본값이 stretch — 명시 안 해도 자식이 늘어난다. 가장 놓치기 쉬운 기본값 불일치.
      layout.counterAxisAlignItems = 'MIN';
      childrenStretch = true;
      break;
    default:
      layout.counterAxisAlignItems = 'MIN';
  }

  // 간격.
  layout.itemSpacing = num(s.gap) ?? num(s.rowGap) ?? num(s.columnGap) ?? 0;

  // 패딩.
  const pad = resolveEdges(s, 'padding');
  layout.paddingTop = pad.top;
  layout.paddingRight = pad.right;
  layout.paddingBottom = pad.bottom;
  layout.paddingLeft = pad.left;

  // 크기.
  layout.width = resolveSizing(s.width, 'width', warnings);
  layout.height = resolveSizing(s.height, 'height', warnings);

  // grow — Figma는 0/1만 지원.
  const flex = num(s.flex) ?? num(s.flexGrow);
  if (flex !== null && flex > 0) {
    layout.grow = 1;
    if (flex > 1) {
      warnings.push(`flex:${flex}는 Figma layoutGrow가 0/1만 지원해 1로 접었습니다.`);
    }
  }

  layout.stretchCrossAxis = s.alignSelf === 'stretch';
  layout.wrap = s.flexWrap === 'wrap';
  if (layout.wrap && layout.mode === 'VERTICAL') {
    warnings.push('Figma layoutWrap은 가로 방향에서만 동작합니다.');
    layout.wrap = false;
  }

  const abs = resolveAbsolute(s, warnings);
  if (abs) layout.absolute = abs;

  return { layout, childrenStretch, warnings };
}

function cornerRadii(s: FlatStyle): IRBox['cornerRadius'] {
  const base = num(s.borderRadius) ?? 0;
  return {
    tl: num(s.borderTopLeftRadius) ?? base,
    tr: num(s.borderTopRightRadius) ?? base,
    br: num(s.borderBottomRightRadius) ?? base,
    bl: num(s.borderBottomLeftRadius) ?? base,
  };
}

export function toBox(style: unknown): BoxResult {
  const s = flattenStyle(style);
  const warnings: string[] = [];
  const box = defaultBox();

  const bg = toSolidPaint(s.backgroundColor);
  // 배경이 없으면 빈 배열 — Figma createFrame()의 기본 흰 배경을 반드시 지워야 한다.
  box.fills = bg ? [bg] : [];

  // borderWidth 0 또는 투명색이면 스트로크를 만들지 않는다 (유령 테두리 방지).
  const bw = num(s.borderWidth) ?? 0;
  const bc = toSolidPaint(s.borderColor);
  if (bw > 0 && bc) {
    box.strokes = [bc];
    box.strokeWeight = bw;
  }

  box.cornerRadius = cornerRadii(s);
  box.opacity = num(s.opacity) ?? 1;
  box.clipsContent = s.overflow === 'hidden';

  // 그림자 — RN shadowOpacity는 색 알파와 곱해진다.
  const shadowOpacity = num(s.shadowOpacity);
  const elevation = num(s.elevation);
  const offset = s.shadowOffset as { width?: number; height?: number } | undefined;

  if (shadowOpacity !== null && shadowOpacity > 0) {
    const c = parseColor(s.shadowColor) ?? { r: 0, g: 0, b: 0, a: 1 };
    box.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: c.r, g: c.g, b: c.b, a: c.a * shadowOpacity },
        offset: { x: offset?.width ?? 0, y: offset?.height ?? 0 },
        radius: (num(s.shadowRadius) ?? 0) * SHADOW_RADIUS_SCALE,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL',
      },
    ];
  } else if (shadowOpacity === null && elevation !== null && elevation > 0) {
    // Android elevation만 있는 경우 — 정확한 대응이 없어 근사한다.
    warnings.push(
      `elevation:${elevation}만 지정돼 그림자를 근사했습니다. Figma에서 확인이 필요합니다.`,
    );
    box.effects = [
      {
        type: 'DROP_SHADOW',
        color: { r: 0, g: 0, b: 0, a: 0.15 },
        offset: { x: 0, y: elevation / 2 },
        radius: elevation * SHADOW_RADIUS_SCALE,
        spread: 0,
        visible: true,
        blendMode: 'NORMAL',
      },
    ];
  }

  return { box, warnings };
}

/** RN fontWeight → Figma font style 이름 후보. 앞에서부터 loadFontAsync를 시도한다. */
export function fontStyleCandidates(weight: unknown): string[] {
  const w = weight === undefined || weight === null ? '400' : String(weight);
  const table: Record<string, string> = {
    '100': 'Thin',
    '200': 'ExtraLight',
    '300': 'Light',
    '400': 'Regular',
    normal: 'Regular',
    '500': 'Medium',
    '600': 'SemiBold',
    '700': 'Bold',
    bold: 'Bold',
    '800': 'ExtraBold',
    '900': 'Black',
  };
  const primary = table[w] ?? 'Regular';
  // Variable 폰트가 어떤 스타일명으로 노출되는지는 설치본마다 다르므로 폴백 체인을 준다.
  const chain = [primary, 'Medium', 'Regular'];
  return [...new Set(chain)];
}

export function toTextStyle(style: unknown): TextResult {
  const s = flattenStyle(style);
  const warnings: string[] = [];

  warnUnsupported(s, warnings);

  const family = typeof s.fontFamily === 'string' ? s.fontFamily : 'PretendardVariable';
  const fill = toSolidPaint(s.color);

  const alignMap: Record<string, IRTextStyle['textAlign']> = {
    left: 'LEFT',
    center: 'CENTER',
    right: 'RIGHT',
    justify: 'JUSTIFIED',
  };

  const variants = Array.isArray(s.fontVariant) ? (s.fontVariant as string[]) : [];

  const text: IRTextStyle = {
    fontFamily: FAMILY_ALIAS[family] ?? family,
    fontStyleCandidates: fontStyleCandidates(s.fontWeight),
    fontSize: num(s.fontSize) ?? 16,
    lineHeight: num(s.lineHeight),
    letterSpacing: num(s.letterSpacing) ?? 0,
    textAlign: alignMap[String(s.textAlign)] ?? 'LEFT',
    // color가 없으면 빈 배열 — 프레임과 달리 텍스트는 Figma 기본값을 유지시킨다.
    fills: fill ? [fill] : [],
    tabularNums: variants.includes('tabular-nums'),
  };

  return { text, warnings };
}
