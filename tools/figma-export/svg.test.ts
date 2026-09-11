// react-native-svg composite 서브트리 → SVG 문자열 재구성.
// 실제 렌더 덤프(tools/figma-export/__spike_out__/icons-variety.json)에서 확인된 형태를 기준으로 한다.
// 색 리터럴은 design-guard(D5) 준수를 위해 tokens에서 가져온다.
import { tokens } from '@/design/tokens';
import { buildSvgString, type SvgSourceNode } from './svg';

const INK = tokens.light.text.primary;

/** lucide가 모든 shape 노드에 상속시키는 페인트 속성 (실측). */
const paint = {
  stroke: INK,
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function node(
  type: string,
  props: Record<string, unknown>,
  children: SvgSourceNode[] = [],
): SvgSourceNode {
  return { type, props, children };
}

function svgRoot(children: SvgSourceNode[], extra: Record<string, unknown> = {}): SvgSourceNode {
  return node(
    'Svg',
    {
      ref: null,
      xmlns: 'http://www.w3.org/2000/svg',
      width: 24,
      height: 24,
      viewBox: '0 0 24 24',
      preserveAspectRatio: 'xMidYMid meet',
      ...paint,
      ...extra,
    },
    children,
  );
}

describe('buildSvgString', () => {
  it('단일 Path 아이콘을 SVG 문자열로 만든다 (확정 = Check)', () => {
    const out = buildSvgString(svgRoot([node('Path', { ...paint, d: 'M20 6 9 17l-5-5' })]));
    expect(out).not.toBeNull();
    expect(out).toContain('<svg');
    expect(out).toContain('viewBox="0 0 24 24"');
    expect(out).toContain('<path');
    expect(out).toContain('d="M20 6 9 17l-5-5"');
    expect(out).toContain('</svg>');
  });

  it('camelCase 속성을 SVG kebab-case로 바꾼다', () => {
    const out = buildSvgString(svgRoot([node('Path', { ...paint, d: 'M0 0' })]))!;
    expect(out).toContain('stroke-width="2"');
    expect(out).toContain('stroke-linecap="round"');
    expect(out).toContain('stroke-linejoin="round"');
    expect(out).not.toContain('strokeWidth');
    expect(out).not.toContain('strokeLinecap');
  });

  it('fill이 없으면 fill="none"을 명시한다 (닫힌 path가 검게 채워지는 것 방지)', () => {
    const out = buildSvgString(svgRoot([node('Path', { ...paint, d: 'M3 8a4 4 0 0 1 4-4Z' })]))!;
    expect(out).toContain('fill="none"');
  });

  it('명시적 fill은 존중한다', () => {
    const out = buildSvgString(
      svgRoot([node('Path', { ...paint, d: 'M0 0' })], { fill: tokens.light.brand[500] }),
    )!;
    expect(out).toContain(`fill="${tokens.light.brand[500]}"`);
    expect(out).not.toContain('fill="none"');
  });

  it('Circle + Path 조합을 순서대로 보존한다 (성공 = CircleCheck)', () => {
    const out = buildSvgString(
      svgRoot([
        node('Circle', { ...paint, cx: '12', cy: '12', r: '10' }),
        node('Path', { ...paint, d: 'm9 12 2 2 4-4' }),
      ]),
    )!;
    expect(out).toContain('<circle');
    expect(out).toContain('cx="12"');
    expect(out).toContain('r="10"');
    expect(out.indexOf('<circle')).toBeLessThan(out.indexOf('<path'));
  });

  it('Line을 변환한다 (경고 = CircleAlert)', () => {
    const out = buildSvgString(
      svgRoot([node('Line', { ...paint, x1: '12', x2: '12', y1: '8', y2: '12' })]),
    )!;
    expect(out).toContain('<line');
    expect(out).toContain('x1="12"');
    expect(out).toContain('y2="12"');
  });

  it('Rect의 rx를 보존한다 (결제 = CreditCard)', () => {
    const out = buildSvgString(
      svgRoot([node('Rect', { ...paint, width: '20', height: '14', x: '2', y: '5', rx: '2' })]),
    )!;
    expect(out).toContain('<rect');
    expect(out).toContain('rx="2"');
  });

  it('Polyline·Polygon·Ellipse도 처리한다 (방어적 커버)', () => {
    const out = buildSvgString(
      svgRoot([
        node('Polyline', { ...paint, points: '1,2 3,4' }),
        node('Polygon', { ...paint, points: '5,6 7,8' }),
        node('Ellipse', { ...paint, cx: '1', cy: '2', rx: '3', ry: '4' }),
      ]),
    )!;
    expect(out).toContain('<polyline');
    expect(out).toContain('<polygon');
    expect(out).toContain('<ellipse');
  });

  it('의미 없는 G는 펼친다 (Figma에 빈 그룹 노드가 쌓이는 것 방지)', () => {
    const out = buildSvgString(
      svgRoot([node('G', { ...paint, style: {} }, [node('Path', { ...paint, d: 'M1 1' })])]),
    )!;
    expect(out).not.toContain('<g');
    expect(out).toContain('<path');
  });

  it('transform이 있는 G는 보존한다', () => {
    const out = buildSvgString(
      svgRoot([
        node('G', { ...paint, transform: 'translate(4 4)' }, [
          node('Path', { ...paint, d: 'M1 1' }),
        ]),
      ]),
    )!;
    expect(out).toContain('<g');
    expect(out).toContain('transform="translate(4 4)"');
  });

  it('React 내부 props(ref·style·testID)는 버린다', () => {
    const out = buildSvgString(
      svgRoot([node('Path', { ...paint, d: 'M1 1', testID: 'x', style: {}, onPress: null })]),
    )!;
    expect(out).not.toContain('ref=');
    expect(out).not.toContain('testID');
    expect(out).not.toContain('style=');
    expect(out).not.toContain('onPress');
  });

  it('숫자 속성을 문자열로 직렬화한다', () => {
    const out = buildSvgString(svgRoot([node('Path', { ...paint, d: 'M1 1' })]))!;
    expect(out).toContain('width="24"');
    expect(out).toContain('height="24"');
  });

  it('속성값의 XML 특수문자를 이스케이프한다', () => {
    const out = buildSvgString(svgRoot([node('Path', { ...paint, d: 'M1 1', id: 'a"b<c&d' })]))!;
    expect(out).not.toContain('a"b<c&d');
    expect(out).toContain('&quot;');
    expect(out).toContain('&lt;');
    expect(out).toContain('&amp;');
  });

  it('그릴 shape가 없으면 null을 반환한다 (호출부가 플레이스홀더로 폴백)', () => {
    expect(buildSvgString(svgRoot([]))).toBeNull();
    expect(buildSvgString(node('View', {}, []))).toBeNull();
  });

  it('viewBox가 없으면 width/height로 합성한다', () => {
    const n = node('Svg', { width: 32, height: 32, ...paint }, [
      node('Path', { ...paint, d: 'M1 1' }),
    ]);
    const out = buildSvgString(n)!;
    expect(out).toContain('viewBox="0 0 32 32"');
  });

  it('중첩 G 안의 shape도 찾는다', () => {
    const out = buildSvgString(
      svgRoot([
        node('G', { ...paint }, [node('G', { ...paint }, [node('Path', { ...paint, d: 'M9 9' })])]),
      ]),
    )!;
    expect(out).toContain('d="M9 9"');
  });
});
