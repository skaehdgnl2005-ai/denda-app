// react-native-svg의 composite 노드 서브트리를 SVG 문자열로 재구성한다.
// Figma 플러그인 쪽에서 figma.createNodeFromSvg()에 그대로 먹인다.
//
// 왜 composite인가: host 노드(RNSVGPath 등)는 색이 정수 payload(0xAARRGGBB)로 뭉개져 있어
// 복원이 불가능하다. composite 노드(Path/Circle/...)는 d·stroke·viewBox가 원본 문자열 그대로 남는다.
//
// 실측 기준 (아이콘 29종 전수): path 62 · circle 16 · line 7 · rect 2.
// Polyline/Polygon/Ellipse는 현재 0건이지만 방어적으로 지원한다.
// 회귀 가드는 svg.test.ts와 normalize.test.tsx의 실제 Button 렌더 통합 테스트에 있다.

/** RTL 트리에서 뽑아낸 최소 노드 형태. react-test-renderer에 의존하지 않는다. */
export interface SvgSourceNode {
  type: string;
  props: Record<string, unknown>;
  children: SvgSourceNode[];
}

/** composite 이름 → SVG 태그명. */
const TAG: Record<string, string> = {
  Path: 'path',
  Circle: 'circle',
  Rect: 'rect',
  Line: 'line',
  Polyline: 'polyline',
  Polygon: 'polygon',
  Ellipse: 'ellipse',
};

/**
 * 태그별 필수 기하 속성. 하나도 없으면 그리는 게 없는 빈 노드이므로 건너뛴다.
 * (d 없는 <path/>는 유효한 XML이지만 아무것도 그리지 않는다.)
 */
const GEOMETRY: Record<string, string[]> = {
  Path: ['d'],
  Circle: ['r'],
  Rect: ['width', 'height'],
  Line: ['x1', 'y1', 'x2', 'y2'],
  Polyline: ['points'],
  Polygon: ['points'],
  Ellipse: ['rx', 'ry'],
};

function hasGeometry(node: SvgSourceNode): boolean {
  const required = GEOMETRY[node.type];
  if (!required) return false;
  return required.some((k) => node.props[k] !== undefined && node.props[k] !== null);
}

/** G를 보존할 이유가 되는 속성 — 이게 없으면 펼쳐서 Figma 그룹 노드를 줄인다. */
const G_MEANINGFUL = ['transform', 'opacity', 'clipPath', 'clip-path', 'mask'];

/** React·RN 전용이라 SVG로 나가면 안 되는 props. */
const DROP = new Set([
  'ref',
  'key',
  'style',
  'children',
  'testID',
  'accessibilityLabel',
  'accessible',
]);

/** camelCase SVG 속성 → kebab-case. 여기 없는 건 그대로 통과. */
const KEBAB: Record<string, string> = {
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeOpacity: 'stroke-opacity',
  strokeMiterlimit: 'stroke-miterlimit',
  fillOpacity: 'fill-opacity',
  fillRule: 'fill-rule',
  clipPath: 'clip-path',
  clipRule: 'clip-rule',
  vectorEffect: 'vector-effect',
};

function escapeAttr(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function serializeAttrs(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [rawKey, value] of Object.entries(props)) {
    if (DROP.has(rawKey)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'function' || typeof value === 'object') continue;
    if (rawKey.startsWith('on')) continue;

    const key = KEBAB[rawKey] ?? rawKey;
    parts.push(`${key}="${escapeAttr(String(value))}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

function isMeaningfulGroup(node: SvgSourceNode): boolean {
  return G_MEANINGFUL.some((k) => node.props[k] !== undefined && node.props[k] !== null);
}

/** shape 노드를 재귀 직렬화. 의미 없는 G는 펼친다. */
function serializeShapes(nodes: SvgSourceNode[]): string {
  let out = '';
  for (const n of nodes) {
    const tag = TAG[n.type];
    if (tag) {
      if (hasGeometry(n)) out += `<${tag}${serializeAttrs(n.props)}/>`;
      continue;
    }
    if (n.type === 'G') {
      const inner = serializeShapes(n.children);
      if (inner.length === 0) continue;
      out += isMeaningfulGroup(n) ? `<g${serializeAttrs(n.props)}>${inner}</g>` : inner;
      continue;
    }
    // 알 수 없는 래퍼(Defs 등)는 내려가서 shape만 건진다.
    if (n.children.length > 0) out += serializeShapes(n.children);
  }
  return out;
}

function hasAnyShape(nodes: SvgSourceNode[]): boolean {
  return nodes.some((n) => hasGeometry(n) || hasAnyShape(n.children));
}

/**
 * composite Svg 노드를 SVG 문자열로 만든다.
 * 그릴 shape가 하나도 없으면 null — 호출부가 플레이스홀더로 폴백한다.
 */
export function buildSvgString(root: SvgSourceNode): string | null {
  if (root.type !== 'Svg') return null;
  if (!hasAnyShape(root.children)) return null;

  const body = serializeShapes(root.children);
  if (body.length === 0) return null;

  const p = root.props;
  const width = p.width ?? 24;
  const height = p.height ?? 24;
  const viewBox = (p.viewBox as string | undefined) ?? `0 0 ${width} ${height}`;

  const rootAttrs: Record<string, unknown> = {
    xmlns: 'http://www.w3.org/2000/svg',
    width,
    height,
    viewBox,
    // lucide 아이콘은 stroke-only. fill을 명시하지 않으면 닫힌 path가 검게 채워진다.
    fill: p.fill ?? 'none',
    stroke: p.stroke,
    strokeWidth: p.strokeWidth,
    strokeLinecap: p.strokeLinecap,
    strokeLinejoin: p.strokeLinejoin,
  };

  return `<svg${serializeAttrs(rootAttrs)}>${body}</svg>`;
}
