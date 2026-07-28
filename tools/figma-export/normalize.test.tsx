// RTL 트리 → IR 변환.
// 단위 테스트는 손으로 만든 SourceNode로, 마지막 통합 테스트는 실제 Button 렌더로 검증한다.
import React from 'react';
import { render } from '@testing-library/react-native';

import { Button } from '@/components/Button';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';
import { normalize, fromTestInstance, type SourceNode } from './normalize';
import type { IRFrame, IRText, IRVector } from './ir';

function host(type: string, style: unknown, children: (SourceNode | string)[] = []): SourceNode {
  return { type, isHost: true, props: style === null ? {} : { style }, children };
}
function composite(type: string, children: (SourceNode | string)[] = []): SourceNode {
  return { type, isHost: false, props: {}, children };
}

const asFrame = (n: unknown): IRFrame => n as IRFrame;

describe('normalize — 노드 중복 제거', () => {
  it('composite/host 이중 방출에서 host만 프레임이 된다 (padding 2배 방지)', () => {
    // RN의 <View>는 composite View → host View 체인으로 내려오며 같은 style을 두 번 방출한다.
    const tree = composite('View', [host('View', { paddingHorizontal: 20 })]);
    const { root } = normalize(tree);
    const f = asFrame(root);
    expect(f.kind).toBe('frame');
    expect(f.layout.paddingLeft).toBe(20);
    expect(f.children).toHaveLength(0); // 중첩 프레임이 생기지 않아야 한다
  });

  it('PressabilityDebugView 같은 팬텀 노드를 버린다', () => {
    const tree = host('View', {}, [
      host('View', { width: 10 }),
      composite('PressabilityDebugView'),
    ]);
    const f = asFrame(normalize(tree).root);
    expect(f.children).toHaveLength(1);
  });

  it('composite 이름을 레이어 이름으로 흡수한다', () => {
    const tree = composite('Button', [composite('Pressable', [host('View', { height: 56 })])]);
    const f = asFrame(normalize(tree).root);
    expect(f.name).toBe('Button');
    expect(f.componentRef).toBe('Button');
  });

  it('RN 내장 컴포넌트 이름은 레이어 이름으로 쓰지 않는다', () => {
    const tree = composite('View', [host('View', { height: 10 })]);
    expect(asFrame(normalize(tree).root).name).toBe('View');
    expect(asFrame(normalize(tree).root).componentRef).toBeUndefined();
  });
});

describe('normalize — 텍스트', () => {
  it('Body→Text→Text(host)→#text 체인을 단일 TEXT로 접는다', () => {
    const tree = composite('Body', [
      composite('Text', [
        host('Text', { fontSize: 16, color: tokens.light.text.primary }, ['확인']),
      ]),
    ]);
    const { root } = normalize(tree);
    const t = root as IRText;
    expect(t.kind).toBe('text');
    expect(t.characters).toBe('확인');
    expect(t.text.fontSize).toBe(16);
    expect(t.text.fills).toHaveLength(1);
  });

  it('여러 조각으로 쪼개진 문자열을 이어붙인다', () => {
    const tree = host('Text', { fontSize: 14 }, ['안녕', '하세요']);
    expect((normalize(tree).root as IRText).characters).toBe('안녕하세요');
  });

  it('중첩 Text의 내용도 모은다', () => {
    const tree = host('Text', {}, ['총 ', host('Text', {}, ['3']), '명']);
    expect((normalize(tree).root as IRText).characters).toBe('총 3명');
  });
});

describe('normalize — SVG', () => {
  const svgTree = composite('Icon', [
    composite('Check', [composite('Svg', [composite('Path', [])])]),
  ]);

  it('composite Svg를 벡터 노드로 바꾼다', () => {
    // props가 필요하므로 직접 구성
    const svg: SourceNode = {
      type: 'Svg',
      isHost: false,
      props: { width: 24, height: 24, viewBox: '0 0 24 24', stroke: tokens.light.text.primary },
      children: [{ type: 'Path', isHost: false, props: { d: 'M20 6 9 17l-5-5' }, children: [] }],
    };
    const tree = composite('Icon', [svg]);
    const v = normalize(tree).root as IRVector;
    expect(v.kind).toBe('vector');
    expect(v.svg).toContain('d="M20 6 9 17l-5-5"');
    expect(v.width).toBe(24);
    expect(v.name).toBe('Icon');
  });

  it('shape가 없는 Svg는 플레이스홀더가 된다', () => {
    const v = normalize(svgTree).root;
    expect(v.kind).toBe('placeholder');
  });

  it('SVG 내부의 host 노드로는 내려가지 않는다 (색이 정수로 뭉개져 있음)', () => {
    const svg: SourceNode = {
      type: 'Svg',
      isHost: false,
      props: { width: 24, height: 24 },
      children: [
        { type: 'Path', isHost: false, props: { d: 'M1 1' }, children: [] },
        { type: 'RNSVGPath', isHost: true, props: { fill: 4278190080 }, children: [] },
      ],
    };
    const v = normalize(svg).root as IRVector;
    expect(v.svg).not.toContain('4278190080');
  });
});

describe('normalize — margin 파이프라인', () => {
  it('가장자리 margin을 부모 padding으로 흡수한다', () => {
    const tree = host('View', { flexDirection: 'column' }, [
      host('View', { marginTop: 16, height: 10 }),
      host('View', { marginBottom: 24, height: 10 }),
    ]);
    const f = asFrame(normalize(tree).root);
    expect(f.layout.paddingTop).toBe(16);
    expect(f.layout.paddingBottom).toBe(24);
  });

  it('균일한 내부 margin을 itemSpacing으로 접는다 (Button의 marginRight:8)', () => {
    const tree = host('View', { flexDirection: 'row' }, [
      host('View', { marginRight: 8, width: 20 }),
      host('View', { width: 30 }),
    ]);
    const f = asFrame(normalize(tree).root);
    expect(f.layout.itemSpacing).toBe(8);
    // 간격을 접었으면 래퍼가 생기면 안 된다
    expect(f.children).toHaveLength(2);
  });

  it('기존 gap과 margin을 합산한다', () => {
    const tree = host('View', { flexDirection: 'row', gap: 4 }, [
      host('View', { marginRight: 8, width: 10 }),
      host('View', { width: 10 }),
    ]);
    expect(asFrame(normalize(tree).root).layout.itemSpacing).toBe(12);
  });

  it('비균일 간격은 최솟값을 itemSpacing으로 접고 잔차를 처리한다', () => {
    const tree = host('View', { flexDirection: 'column' }, [
      host('View', { marginBottom: 8, height: 10 }),
      host('View', { marginBottom: 24, height: 10 }),
      host('View', { height: 10 }),
    ]);
    const f = asFrame(normalize(tree).root);
    expect(f.layout.itemSpacing).toBe(8);
    // 잔차 16은 두 번째 자식이 흡수 (도색 없는 프레임 + HUG이므로 자체 padding)
    const second = asFrame(f.children[1]);
    expect(second.layout.paddingBottom).toBe(16);
  });

  it('도색된 자식의 잔차는 투명 래퍼로 감싼다 (배경이 여백까지 번지는 것 방지)', () => {
    const tree = host('View', { flexDirection: 'column' }, [
      host('View', { marginBottom: 4, height: 10 }),
      host('View', { marginBottom: 20, height: 10, backgroundColor: tokens.light.surface[2] }),
      host('View', { height: 10 }),
    ]);
    const f = asFrame(normalize(tree).root);
    const wrapper = asFrame(f.children[1]);
    expect(wrapper.name).toContain('margin');
    expect(wrapper.box.fills).toEqual([]);
    expect(wrapper.layout.paddingBottom).toBe(16);
    expect(wrapper.children).toHaveLength(1);
  });

  it('텍스트 자식의 잔차도 래퍼로 감싼다 (Figma에서 TEXT는 padding을 못 가진다)', () => {
    const tree = host('View', { flexDirection: 'column' }, [
      host('View', { marginBottom: 4, height: 10 }),
      host('Text', { marginBottom: 20 }, ['라벨']),
      host('View', { height: 10 }),
    ]);
    const f = asFrame(normalize(tree).root);
    const wrapper = asFrame(f.children[1]);
    expect(wrapper.kind).toBe('frame');
    expect(wrapper.layout.paddingBottom).toBe(16);
    expect(wrapper.children[0]!.kind).toBe('text');
  });

  it('margin이 전혀 없으면 파이프라인이 아무것도 바꾸지 않는다', () => {
    const tree = host('View', { flexDirection: 'row', gap: 8 }, [
      host('View', { width: 10 }),
      host('View', { width: 10 }),
    ]);
    const f = asFrame(normalize(tree).root);
    expect(f.layout.itemSpacing).toBe(8);
    expect(f.layout.paddingTop).toBe(0);
    expect(f.children.every((c) => !c.name.includes('margin'))).toBe(true);
  });
});

describe('normalize — stretch 전파', () => {
  it('부모의 alignItems 기본값(stretch)을 자식 layoutAlign으로 내린다', () => {
    const tree = host('View', { flexDirection: 'column' }, [host('View', { height: 10 })]);
    const f = asFrame(normalize(tree).root);
    expect(asFrame(f.children[0]).layout.stretchCrossAxis).toBe(true);
  });

  it('alignItems가 명시되면 자식을 늘리지 않는다', () => {
    const tree = host('View', { flexDirection: 'column', alignItems: 'center' }, [
      host('View', { height: 10 }),
    ]);
    const f = asFrame(normalize(tree).root);
    expect(asFrame(f.children[0]).layout.stretchCrossAxis).toBe(false);
  });
});

describe('normalize — 경고 수집', () => {
  it('미지원 속성 경고를 문서 레벨로 모은다', () => {
    const tree = host('View', { transform: [{ rotate: '45deg' }] });
    const { warnings } = normalize(tree);
    expect(warnings.join()).toContain('transform');
  });

  it('경고가 있는 노드에 표시를 남긴다', () => {
    const tree = host('View', { width: '48%' });
    const f = asFrame(normalize(tree).root);
    expect(f.warnings && f.warnings.length).toBeGreaterThan(0);
  });
});

describe('normalize — 실제 Button 통합', () => {
  it('렌더된 Button을 IR로 변환한다', () => {
    const r = render(
      <ThemeProvider>
        <Button label="확인" onPress={() => {}} leftIcon="확정" variant="primary" />
      </ThemeProvider>,
    );
    const source = fromTestInstance(r.UNSAFE_root);
    const { root, warnings } = normalize(source);

    // 루트는 Button 프레임
    const f = asFrame(root);
    expect(f.kind).toBe('frame');
    expect(f.name).toBe('Button');

    // 실제 스타일이 옮겨졌는가
    expect(f.layout.height).toBe(56);
    expect(f.layout.width).toBe('FILL');
    expect(f.layout.mode).toBe('HORIZONTAL');
    expect(f.layout.primaryAxisAlignItems).toBe('CENTER');
    expect(f.layout.counterAxisAlignItems).toBe('CENTER');
    expect(f.layout.paddingLeft).toBe(20);
    expect(f.box.cornerRadius.tl).toBe(8);

    // brand-500 배경 (보라)
    expect(f.box.fills).toHaveLength(1);
    expect(f.box.fills[0]!.color.r).toBeCloseTo(124 / 255, 2);

    // borderWidth:0 + transparent → 유령 스트로크 없음
    expect(f.box.strokes).toEqual([]);

    // 아이콘 margin이 itemSpacing으로 접혔는가
    expect(f.layout.itemSpacing).toBe(8);

    // 자식: 아이콘 벡터 + 라벨 텍스트
    const kinds = f.children.map((c) => c.kind);
    expect(kinds).toContain('vector');
    expect(kinds).toContain('text');

    const label = f.children.find((c) => c.kind === 'text') as IRText;
    expect(label.characters).toBe('확인');
    expect(label.text.fontFamily).toBe('Pretendard Variable');
    expect(label.text.fontSize).toBe(16);
    expect(label.text.fontStyleCandidates[0]).toBe('SemiBold');
    // 흰 라벨 — 이 매핑이 빠지면 보라 버튼 위 검은 글씨가 된다
    expect(label.text.fills[0]!.color).toEqual({ r: 1, g: 1, b: 1 });

    const icon = f.children.find((c) => c.kind === 'vector') as IRVector;
    expect(icon.svg).toContain('<path');
    expect(icon.svg).toContain('fill="none"');

    // 미지원 속성이 조용히 섞여 있지 않은지 확인
    expect(warnings.filter((w) => w.includes('미지원'))).toEqual([]);
  });
});
