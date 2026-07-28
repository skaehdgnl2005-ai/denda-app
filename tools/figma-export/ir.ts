// 중간 표현(IR) — RN 트리와 Figma 사이의 유일한 계약.
//
// 설계 의도:
//  - normalize.ts는 IR을 만들고, plugin/code.ts는 IR을 읽는다. 둘은 서로를 모른다.
//  - IR은 JSON 직렬화 가능해야 한다 (dump.json으로 디스크를 건너간다).
//  - 필드명은 Figma Plugin API에 최대한 가깝게 둬서 플러그인 코드를 멍청하게 유지한다.

/** Figma SOLID paint. color는 0..1. */
export interface IRPaint {
  type: 'SOLID';
  color: { r: number; g: number; b: number };
  opacity: number;
}

/** Figma DropShadowEffect는 visible·blendMode가 필수다 (plugin-api.d.ts:4117-4130). */
export interface IREffect {
  type: 'DROP_SHADOW';
  color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number };
  radius: number;
  spread: number;
  visible: boolean;
  blendMode: 'NORMAL';
}

/** 축 방향 크기 정책. 숫자면 고정(FIXED) px. */
export type IRSizing = number | 'FILL' | 'HUG';

export interface IRLayout {
  /** RN flexDirection → Figma layoutMode. NONE이면 자식을 절대 배치. */
  mode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  /** RN justifyContent → primaryAxisAlignItems */
  primaryAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  /** RN alignItems → counterAxisAlignItems */
  counterAxisAlignItems: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  itemSpacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  width: IRSizing;
  height: IRSizing;
  /** RN flexWrap → layoutWrap */
  wrap: boolean;
  /** RN flex:1 → layoutGrow */
  grow: number;
  /** RN alignSelf:'stretch' → layoutAlign */
  stretchCrossAxis: boolean;
  /** position:'absolute'인 자식. 부모 기준 오프셋 + 어느 변에 붙었는지. */
  absolute?: IRAbsolute;
}

export interface IRAbsolute {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
  /** Figma constraints — 지정된 변에 따라 결정한다. */
  horizontal: 'MIN' | 'MAX' | 'STRETCH' | 'CENTER';
  vertical: 'MIN' | 'MAX' | 'STRETCH' | 'CENTER';
}

export interface IRBox {
  fills: IRPaint[];
  strokes: IRPaint[];
  strokeWeight: number;
  /** 4개가 모두 같으면 cornerRadius, 다르면 개별 지정 */
  cornerRadius: { tl: number; tr: number; br: number; bl: number };
  opacity: number;
  clipsContent: boolean;
  effects: IREffect[];
}

export interface IRTextStyle {
  fontFamily: string;
  /** RN fontWeight('400'|'600'…) → Figma font style 이름 후보 목록 (앞에서부터 시도) */
  fontStyleCandidates: string[];
  fontSize: number;
  /** px. RN lineHeight는 항상 px 단위다. */
  lineHeight: number | null;
  letterSpacing: number;
  textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  fills: IRPaint[];
  /** tabular-nums 등 OpenType feature */
  tabularNums: boolean;
}

interface IRNodeBase {
  /** Figma 레이어 이름. 컴포넌트 경계가 있으면 그 이름을 쓴다. */
  name: string;
  /** 이 노드가 어느 앱 컴포넌트에서 왔는지 (예: 'Button'). 나중에 수동 컴포넌트화할 때의 단서. */
  componentRef?: string;
  /**
   * 충실도가 보장되지 않는 지점. 플러그인이 레이어명 앞에 ⚠️를 붙여
   * Figma 캔버스 안에서 눈으로 찾을 수 있게 한다 (문서 경고보다 훨씬 빨리 잡힌다).
   */
  warnings?: string[];
}

export interface IRFrame extends IRNodeBase {
  kind: 'frame';
  layout: IRLayout;
  box: IRBox;
  children: IRNode[];
}

export interface IRText extends IRNodeBase {
  kind: 'text';
  characters: string;
  text: IRTextStyle;
  layout: IRLayout;
}

export interface IRVector extends IRNodeBase {
  kind: 'vector';
  /** figma.createNodeFromSvg()에 그대로 넣는다. */
  svg: string;
  width: number;
  height: number;
  layout: IRLayout;
}

/** 재현 불가 영역(네이티브 지도·이미지 asset 등). Figma에 회색 박스 + 사유 라벨로 찍는다. */
export interface IRPlaceholder extends IRNodeBase {
  kind: 'placeholder';
  reason: string;
  layout: IRLayout;
  box: IRBox;
}

export type IRNode = IRFrame | IRText | IRVector | IRPlaceholder;

/** 한 픽스처를 한 테마로 렌더한 결과. */
export interface IRArtboard {
  id: string;
  /** Figma 페이지 그룹 라벨 (예: 'Buttons', 'Screens') */
  group: string;
  name: string;
  theme: 'light' | 'dark';
  /** 아트보드 폭. 화면은 390, 컴포넌트는 내용에 맞춤(null=HUG). */
  frameWidth: number | null;
  root: IRNode;
}

export interface IRDocument {
  /** 생성 시각 (KST ISO). dump 시점에 luxon DateTime.now().setZone('Asia/Seoul')으로 주입 (D13). */
  generatedAt: string;
  artboards: IRArtboard[];
  /** 변환 중 버린 것들 — 플러그인이 실행 후 요약으로 보여준다. */
  warnings: string[];
}

/** 기본 레이아웃 (스타일이 아무것도 없을 때). RN 기본값 기준: column + stretch. */
export function defaultLayout(): IRLayout {
  return {
    mode: 'VERTICAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    width: 'HUG',
    height: 'HUG',
    wrap: false,
    grow: 0,
    stretchCrossAxis: false,
  };
}

export function defaultBox(): IRBox {
  return {
    fills: [],
    strokes: [],
    strokeWeight: 0,
    cornerRadius: { tl: 0, tr: 0, br: 0, bl: 0 },
    opacity: 1,
    clipsContent: false,
    effects: [],
  };
}
