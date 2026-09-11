// RTL 테스트 인스턴스 트리 → IR.
//
// 이 파일이 다루는 4가지 현실 (실덤프에서 확인):
//  1. RN의 <View>는 composite View → host View 체인으로 내려오며 같은 style을 두 번 방출한다.
//     → host만 프레임으로 승격하고 composite는 이름만 흡수한다. 안 하면 padding이 2배가 된다.
//  2. PressabilityDebugView 같은 팬텀 노드가 자식 수를 오염시킨다. → 버린다.
//  3. Body → Text(composite) → Text(host) → #text 3중 체인. → 단일 TEXT로 접는다.
//  4. SVG는 composite 계층에만 온전한 값이 있다(host는 색이 정수로 뭉개짐). → composite Svg에서 가로챈다.

import { buildSvgString, type SvgSourceNode } from './svg';
import {
  defaultBox,
  defaultLayout,
  type IRFrame,
  type IRNode,
  type IRPlaceholder,
  type IRText,
  type IRVector,
} from './ir';
import { extractMargin, flattenStyle, toBox, toLayout, toTextStyle, type Edges } from './style';

export interface SourceNode {
  type: string;
  isHost: boolean;
  props: Record<string, unknown>;
  children: (SourceNode | string)[];
}

export interface NormalizeResult {
  root: IRNode;
  warnings: string[];
}

/** 레이어 이름으로 쓸 가치가 없는 이름들 (RN 내장 · 하네스 래퍼). */
const NOT_MEANINGFUL = new Set([
  'View',
  'Text',
  'Pressable',
  'TouchableOpacity',
  'TouchableHighlight',
  'TouchableWithoutFeedback',
  'TouchableNativeFeedback',
  'ScrollView',
  'SafeAreaView',
  'Modal',
  'Image',
  'TextInput',
  'FlatList',
  'VirtualizedList',
  'SectionList',
  'ActivityIndicator',
  'KeyboardAvoidingView',
  'Fragment',
  'Object',
  'Anonymous',
  'ForwardRef',
  'Memo',
  'Unknown',
  'ThemeProvider',
  'ToastProvider',
  'SafeAreaProvider',
  'RCTSafeAreaProvider',
  'AnimatedComponent',
  'Wrapper',
]);

/** 스타일도 자식도 없이 트리만 더럽히는 노드. */
const PHANTOM = new Set(['PressabilityDebugView']);

const TEXT_HOSTS = new Set(['Text', 'RCTText', 'RNCText']);

/** 재현 불가 — 회색 박스 + 사유로 대체한다. */
const NATIVE_PLACEHOLDER: Record<string, string> = {
  Image: '이미지 asset',
  RCTImageView: '이미지 asset',
  RNCNaverMapView: '네이버 지도 (네이티브 뷰)',
  RNSVGSvgView: 'SVG (host 계층 — 재구성 실패)',
};

interface WalkItem {
  node: IRNode;
  margin: Edges;
}

interface Ctx {
  /** 이 노드까지 내려오며 만난 composite 이름들. */
  names: string[];
  warnings: string[];
}

function meaningfulName(names: string[], fallback: string): { name: string; ref?: string } {
  const found = names.find((n) => !NOT_MEANINGFUL.has(n));
  return found ? { name: found, ref: found } : { name: fallback };
}

/**
 * SourceNode 서브트리를 svg.ts가 먹을 수 있는 형태로 변환.
 * host를 걸러내면 안 된다 — 실제 트리는 composite/host가 번갈아 나오므로
 * (Svg → RNSVGSvgView(c) → RNSVGSvgView(h) → G(c) → …) host를 지우면 그 아래가 통째로 끊긴다.
 * 대신 svg.ts가 shape 태그명(Path/Circle/…)만 직렬화하고 RNSVG* host는 이름으로 걸러낸다.
 */
function toSvgSource(node: SourceNode): SvgSourceNode {
  return {
    type: node.type,
    props: node.props,
    children: node.children.filter((c): c is SourceNode => typeof c !== 'string').map(toSvgSource),
  };
}

function collectText(node: SourceNode): string {
  let out = '';
  for (const c of node.children) {
    if (typeof c === 'string') out += c;
    else out += collectText(c);
  }
  return out;
}

function isUnpainted(node: IRNode): boolean {
  if (node.kind !== 'frame') return false;
  const b = node.box;
  return (
    b.fills.length === 0 &&
    b.strokes.length === 0 &&
    b.effects.length === 0 &&
    b.opacity === 1 &&
    !b.clipsContent &&
    b.cornerRadius.tl === 0 &&
    b.cornerRadius.tr === 0 &&
    b.cornerRadius.br === 0 &&
    b.cornerRadius.bl === 0
  );
}

/** 자식 하나만 감싸고 아무 시각·레이아웃 효과가 없는 프레임은 없애도 기하가 같다. */
function collapseRedundant(node: IRNode): IRNode {
  if (node.kind !== 'frame') return node;
  if (node.children.length !== 1) return node;
  if (!isUnpainted(node)) return node;

  const l = node.layout;
  const inert =
    l.paddingTop === 0 &&
    l.paddingRight === 0 &&
    l.paddingBottom === 0 &&
    l.paddingLeft === 0 &&
    l.itemSpacing === 0 &&
    l.width === 'HUG' &&
    l.height === 'HUG' &&
    l.grow === 0 &&
    !l.absolute;
  if (!inert) return node;

  const child = node.children[0];
  if (!child) return node;
  // 래퍼가 갖고 있던 교차축 stretch는 자식이 이어받아야 기하가 유지된다.
  if (node.layout.stretchCrossAxis) child.layout.stretchCrossAxis = true;
  return child;
}

function wrapForMargin(child: IRNode, pad: Partial<Edges>): IRFrame {
  const layout = defaultLayout();
  layout.mode = 'VERTICAL';
  layout.paddingTop = pad.top ?? 0;
  layout.paddingRight = pad.right ?? 0;
  layout.paddingBottom = pad.bottom ?? 0;
  layout.paddingLeft = pad.left ?? 0;
  layout.stretchCrossAxis = child.layout.stretchCrossAxis;
  layout.grow = child.layout.grow;
  child.layout.grow = 0;

  return {
    kind: 'frame',
    name: `${child.name} · margin`,
    layout,
    box: defaultBox(),
    children: [child],
  };
}

/** 자식 프레임에 padding을 직접 얹을 수 있는가 (Figma에서 TEXT는 padding을 못 가진다). */
function canAbsorbPadding(node: IRNode, axis: 'vertical' | 'horizontal'): boolean {
  if (node.kind !== 'frame') return false;
  if (!isUnpainted(node)) return false;
  const size = axis === 'vertical' ? node.layout.height : node.layout.width;
  return size === 'HUG';
}

/**
 * RN margin을 Figma가 표현할 수 있는 형태로 옮긴다.
 *  1) 가장자리 margin → 부모 padding
 *  2) 내부 간격의 최솟값 → itemSpacing
 *  3) 잔차 → 자식 자체 padding (도색 없는 HUG 프레임일 때만)
 *  4) 나머지 → 투명 래퍼 프레임
 */
function applyMargins(frame: IRFrame, items: WalkItem[]): IRNode[] {
  const flow = items.filter((i) => !i.node.layout.absolute);
  const fixed = items.filter((i) => i.node.layout.absolute);
  if (flow.length === 0) return items.map((i) => i.node);

  const horizontal = frame.layout.mode === 'HORIZONTAL';
  const lead = (m: Edges): number => (horizontal ? m.left : m.top);
  const trail = (m: Edges): number => (horizontal ? m.right : m.bottom);
  const crossLead = (m: Edges): number => (horizontal ? m.top : m.left);
  const crossTrail = (m: Edges): number => (horizontal ? m.bottom : m.right);

  const margins = flow.map((i) => ({ ...i.margin }));

  // 1) 주축 가장자리 → 부모 padding
  const first = margins[0];
  const last = margins[margins.length - 1];
  if (!first || !last) return items.map((i) => i.node);
  if (horizontal) {
    frame.layout.paddingLeft += lead(first);
    frame.layout.paddingRight += trail(last);
    first.left = 0;
    last.right = 0;
  } else {
    frame.layout.paddingTop += lead(first);
    frame.layout.paddingBottom += trail(last);
    first.top = 0;
    last.bottom = 0;
  }

  // 1b) 교차축이 전 자식 동일하면 부모 padding으로 흡수
  const cl = margins.map(crossLead);
  const ct = margins.map(crossTrail);
  const uniform = (xs: number[]): boolean => xs.every((x) => x === xs[0]);
  const cl0 = cl[0] ?? 0;
  const ct0 = ct[0] ?? 0;
  if (uniform(cl) && cl0 > 0) {
    if (horizontal) frame.layout.paddingTop += cl0;
    else frame.layout.paddingLeft += cl0;
    margins.forEach((m) => (horizontal ? (m.top = 0) : (m.left = 0)));
  }
  if (uniform(ct) && ct0 > 0) {
    if (horizontal) frame.layout.paddingBottom += ct0;
    else frame.layout.paddingRight += ct0;
    margins.forEach((m) => (horizontal ? (m.bottom = 0) : (m.right = 0)));
  }

  // 2) 내부 간격 최솟값 → itemSpacing
  const zero: Edges = { top: 0, right: 0, bottom: 0, left: 0 };
  const gaps: number[] = [];
  for (let i = 0; i < margins.length - 1; i++) {
    gaps.push(trail(margins[i] ?? zero) + lead(margins[i + 1] ?? zero));
  }
  if (gaps.length > 0) {
    const min = Math.min(...gaps);
    frame.layout.itemSpacing += min;
    for (let i = 0; i < gaps.length; i++) {
      const residual = (gaps[i] ?? 0) - min;
      const a = margins[i];
      const b = margins[i + 1];
      if (!a || !b) continue;
      // 잔차는 앞쪽 자식의 뒤쪽 여백으로 몰아준다.
      if (horizontal) {
        a.right = residual;
        b.left = 0;
      } else {
        a.bottom = residual;
        b.top = 0;
      }
    }
  }

  // 3·4) 남은 margin을 자식이 흡수하거나 래퍼로 감싼다
  const out: IRNode[] = flow.map((item, idx) => {
    const m = margins[idx] ?? zero;
    const rest: Edges = { top: m.top, right: m.right, bottom: m.bottom, left: m.left };
    if (rest.top === 0 && rest.right === 0 && rest.bottom === 0 && rest.left === 0) {
      return item.node;
    }
    const axis: 'vertical' | 'horizontal' =
      rest.top !== 0 || rest.bottom !== 0 ? 'vertical' : 'horizontal';
    if (canAbsorbPadding(item.node, axis)) {
      const f = item.node as IRFrame;
      f.layout.paddingTop += rest.top;
      f.layout.paddingRight += rest.right;
      f.layout.paddingBottom += rest.bottom;
      f.layout.paddingLeft += rest.left;
      return f;
    }
    return wrapForMargin(item.node, rest);
  });

  return [...out, ...fixed.map((i) => i.node)];
}

function walk(node: SourceNode | string, ctx: Ctx): WalkItem[] {
  if (typeof node === 'string') return [];
  if (PHANTOM.has(node.type)) return [];

  // --- composite: 이름만 흡수하고 통과 ---
  if (!node.isHost) {
    if (node.type === 'Svg') return [buildVector(node, ctx)];
    const next: Ctx = { names: [...ctx.names, node.type], warnings: ctx.warnings };
    return node.children.flatMap((c) => walk(c, next));
  }

  // --- host ---
  const placeholderReason = NATIVE_PLACEHOLDER[node.type];
  if (placeholderReason) return [buildPlaceholder(node, ctx, placeholderReason)];
  if (TEXT_HOSTS.has(node.type)) return [buildText(node, ctx)];
  return [buildFrame(node, ctx)];
}

function buildVector(node: SourceNode, ctx: Ctx): WalkItem {
  const svg = buildSvgString(toSvgSource(node));
  const { name, ref } = meaningfulName(ctx.names, 'Icon');
  const width = typeof node.props.width === 'number' ? node.props.width : 24;
  const height = typeof node.props.height === 'number' ? node.props.height : 24;

  if (!svg) {
    ctx.warnings.push(`${name}: SVG를 재구성하지 못해 플레이스홀더로 대체했습니다.`);
    const layout = defaultLayout();
    layout.width = width;
    layout.height = height;
    const ph: IRPlaceholder = {
      kind: 'placeholder',
      name,
      componentRef: ref,
      reason: 'SVG 재구성 실패',
      layout,
      box: defaultBox(),
      warnings: ['SVG 재구성 실패'],
    };
    return { node: ph, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
  }

  const layout = defaultLayout();
  layout.width = width;
  layout.height = height;
  const vec: IRVector = { kind: 'vector', name, componentRef: ref, svg, width, height, layout };
  return { node: vec, margin: { top: 0, right: 0, bottom: 0, left: 0 } };
}

function buildText(node: SourceNode, ctx: Ctx): WalkItem {
  const style = node.props.style;
  const { text, warnings } = toTextStyle(style);
  const { layout } = toLayout(style);
  const { name, ref } = meaningfulName(ctx.names, 'Text');
  ctx.warnings.push(...warnings);

  const out: IRText = {
    kind: 'text',
    name,
    componentRef: ref,
    characters: collectText(node),
    text,
    layout,
  };
  if (warnings.length > 0) out.warnings = warnings;
  return { node: out, margin: extractMargin(flattenStyle(style)) };
}

function buildPlaceholder(node: SourceNode, ctx: Ctx, reason: string): WalkItem {
  const style = node.props.style;
  const { layout } = toLayout(style);
  const { box } = toBox(style);
  const { name, ref } = meaningfulName(ctx.names, node.type);
  ctx.warnings.push(`${name}: ${reason} — 플레이스홀더로 대체했습니다.`);

  const ph: IRPlaceholder = {
    kind: 'placeholder',
    name,
    componentRef: ref,
    reason,
    layout,
    box,
    warnings: [reason],
  };
  return { node: ph, margin: extractMargin(flattenStyle(style)) };
}

function buildFrame(node: SourceNode, ctx: Ctx): WalkItem {
  const style = node.props.style;
  const layoutResult = toLayout(style);
  const boxResult = toBox(style);
  const warnings = [...layoutResult.warnings, ...boxResult.warnings];
  ctx.warnings.push(...warnings);

  const { name, ref } = meaningfulName(ctx.names, node.type);

  const frame: IRFrame = {
    kind: 'frame',
    name,
    componentRef: ref,
    layout: layoutResult.layout,
    box: boxResult.box,
    children: [],
  };
  if (warnings.length > 0) frame.warnings = warnings;

  const childCtx: Ctx = { names: [], warnings: ctx.warnings };
  const items = node.children.flatMap((c) => walk(c, childCtx));

  // RN alignItems 기본값이 stretch — Figma에선 자식마다 내려줘야 한다.
  if (layoutResult.childrenStretch) {
    for (const item of items) {
      if (!item.node.layout.absolute) item.node.layout.stretchCrossAxis = true;
    }
  }

  frame.children = applyMargins(frame, items).map(collapseRedundant);

  return { node: frame, margin: extractMargin(flattenStyle(style)) };
}

export function normalize(source: SourceNode): NormalizeResult {
  const warnings: string[] = [];
  const items = walk(source, { names: [], warnings });

  // 루트는 접지 않는다 — 아트보드의 최상위 프레임은 이름·경계를 유지해야 한다.
  const only = items[0];
  if (items.length === 1 && only) {
    return { root: only.node, warnings };
  }

  // 루트가 여러 개면 감싸는 프레임을 만든다.
  const frame: IRFrame = {
    kind: 'frame',
    name: 'Root',
    layout: defaultLayout(),
    box: defaultBox(),
    children: items.map((i) => i.node),
  };
  return { root: frame, warnings };
}

// --- RTL 어댑터 -------------------------------------------------------------

interface TestInstanceLike {
  type: unknown;
  props?: Record<string, unknown>;
  children?: (TestInstanceLike | string)[];
}

function typeName(t: unknown): string {
  if (typeof t === 'string') return t;
  if (typeof t === 'function') {
    const fn = t as { displayName?: string; name?: string };
    return fn.displayName || fn.name || 'Anonymous';
  }
  if (t && typeof t === 'object') {
    const o = t as { displayName?: string; render?: { name?: string }; type?: unknown };
    if (o.displayName) return o.displayName;
    if (o.render?.name) return o.render.name;
    if (o.type) return typeName(o.type); // React.memo
  }
  return 'Unknown';
}

/** @testing-library/react-native의 UNSAFE_root를 SourceNode로 변환한다. */
export function fromTestInstance(instance: TestInstanceLike | string): SourceNode {
  if (typeof instance === 'string') {
    return { type: '#text', isHost: true, props: {}, children: [instance] };
  }
  return {
    type: typeName(instance.type),
    isHost: typeof instance.type === 'string',
    props: instance.props ?? {},
    children: (instance.children ?? []).map((c) =>
      typeof c === 'string' ? c : fromTestInstance(c),
    ),
  };
}
