// RN 스타일 → Figma Auto Layout 매핑.
// 테스트 대상은 적대적 검증에서 드러난 함정들 — 조용히 틀리는 지점을 우선 고정한다.
// 색 리터럴은 design-guard(D5) 준수를 위해 tokens에서 가져온다.
import { tokens } from '@/design/tokens';
import {
  flattenStyle,
  toLayout,
  toBox,
  toTextStyle,
  extractMargin,
  fontStyleCandidates,
} from './style';

describe('flattenStyle', () => {
  it('중첩 배열과 null을 재귀적으로 평탄화한다', () => {
    // 실덤프 형태: [obj, null] / [obj, obj, null] / [[obj], obj]
    expect(flattenStyle([{ a: 1 }, null, [{ b: 2 }, undefined], { c: 3 }])).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it('뒤에 오는 값이 앞을 덮는다 (RN 스타일 병합 순서)', () => {
    expect(flattenStyle([{ x: 1 }, { x: 2 }])).toEqual({ x: 2 });
  });

  it('함수 스타일(({pressed})=>...)은 무시한다', () => {
    expect(flattenStyle(() => ({ a: 1 }))).toEqual({});
    expect(flattenStyle(undefined)).toEqual({});
    expect(flattenStyle(null)).toEqual({});
  });
});

describe('toLayout — 방향과 정렬', () => {
  it('flexDirection 미지정은 VERTICAL (RN 기본 column)', () => {
    expect(toLayout({}).layout.mode).toBe('VERTICAL');
  });

  it("flexDirection:'row'는 HORIZONTAL", () => {
    expect(toLayout({ flexDirection: 'row' }).layout.mode).toBe('HORIZONTAL');
  });

  it('justifyContent를 primaryAxisAlignItems로 매핑한다', () => {
    expect(toLayout({ justifyContent: 'center' }).layout.primaryAxisAlignItems).toBe('CENTER');
    expect(toLayout({ justifyContent: 'flex-end' }).layout.primaryAxisAlignItems).toBe('MAX');
    expect(toLayout({ justifyContent: 'space-between' }).layout.primaryAxisAlignItems).toBe(
      'SPACE_BETWEEN',
    );
    expect(toLayout({}).layout.primaryAxisAlignItems).toBe('MIN');
  });

  it('space-around/evenly는 Figma에 대응물이 없어 경고와 함께 근사한다', () => {
    const r = toLayout({ justifyContent: 'space-around' });
    expect(r.layout.primaryAxisAlignItems).toBe('SPACE_BETWEEN');
    expect(r.warnings.join()).toContain('space-around');
  });

  it("alignItems:'stretch'는 부모 값이 아니다 — 자식에게 내려보낸다", () => {
    // Figma counterAxisAlignItems: 'MIN'|'MAX'|'CENTER'|'BASELINE' (STRETCH 없음)
    const r = toLayout({ alignItems: 'stretch' });
    expect(r.layout.counterAxisAlignItems).toBe('MIN');
    expect(r.childrenStretch).toBe(true);
  });

  it('alignItems 미지정도 stretch다 (RN 기본값) — 조용히 틀리기 쉬운 지점', () => {
    const r = toLayout({});
    expect(r.childrenStretch).toBe(true);
  });

  it('alignItems가 명시되면 childrenStretch는 꺼진다', () => {
    expect(toLayout({ alignItems: 'center' }).childrenStretch).toBe(false);
    expect(toLayout({ alignItems: 'center' }).layout.counterAxisAlignItems).toBe('CENTER');
    // baseline은 가로 방향에서만 유효 (실사용: BrandMark.tsx:66 flexDirection:'row')
    expect(
      toLayout({ flexDirection: 'row', alignItems: 'baseline' }).layout.counterAxisAlignItems,
    ).toBe('BASELINE');
  });

  it('세로 축에서 baseline은 Figma가 지원하지 않아 MIN으로 내리고 경고한다', () => {
    const r = toLayout({ flexDirection: 'column', alignItems: 'baseline' });
    expect(r.layout.counterAxisAlignItems).toBe('MIN');
    expect(r.warnings.join()).toContain('baseline');
  });
});

describe('toLayout — padding 우선순위', () => {
  it('구체 지정이 축 지정을 이긴다', () => {
    const l = toLayout({ padding: 4, paddingHorizontal: 10, paddingTop: 20 }).layout;
    expect(l.paddingTop).toBe(20);
    expect(l.paddingBottom).toBe(4);
    expect(l.paddingLeft).toBe(10);
    expect(l.paddingRight).toBe(10);
  });

  it('paddingHorizontal만 있으면 좌우에만 적용한다 (Button 실사례)', () => {
    const l = toLayout({ paddingHorizontal: 20 }).layout;
    expect([l.paddingLeft, l.paddingRight]).toEqual([20, 20]);
    expect([l.paddingTop, l.paddingBottom]).toEqual([0, 0]);
  });
});

describe('toLayout — 크기 정책', () => {
  it('숫자 width는 고정값', () => {
    expect(toLayout({ width: 56 }).layout.width).toBe(56);
  });

  it("width:'100%'는 FILL", () => {
    expect(toLayout({ width: '100%' }).layout.width).toBe('FILL');
  });

  it('미지정은 HUG', () => {
    expect(toLayout({}).layout.width).toBe('HUG');
    expect(toLayout({}).layout.height).toBe('HUG');
  });

  it('flex:1은 grow=1 (Figma layoutGrow는 0/1만 허용)', () => {
    expect(toLayout({ flex: 1 }).layout.grow).toBe(1);
  });

  it('flex:2 이상은 Figma가 표현 못 해 1로 접고 경고한다', () => {
    const r = toLayout({ flex: 2 });
    expect(r.layout.grow).toBe(1);
    expect(r.warnings.join()).toContain('flex');
  });

  it("alignSelf:'stretch'는 자식 레벨 STRETCH 플래그", () => {
    expect(toLayout({ alignSelf: 'stretch' }).layout.stretchCrossAxis).toBe(true);
  });

  it('퍼센트 폭 중 100%가 아닌 값은 표현 불가 — HUG + 경고', () => {
    const r = toLayout({ width: '48%' });
    expect(r.layout.width).toBe('HUG');
    expect(r.warnings.join()).toContain('48%');
  });
});

describe('toLayout — 절대 배치', () => {
  it('네 변이 모두 0이면 양방향 STRETCH (TimeGrid/Cell 실사례)', () => {
    const l = toLayout({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }).layout;
    expect(l.absolute).toBeDefined();
    expect(l.absolute!.horizontal).toBe('STRETCH');
    expect(l.absolute!.vertical).toBe('STRETCH');
  });

  it('top/left만 있으면 MIN 앵커', () => {
    const l = toLayout({ position: 'absolute', top: 2, left: 4 }).layout;
    expect(l.absolute!.vertical).toBe('MIN');
    expect(l.absolute!.horizontal).toBe('MIN');
  });

  it('right/bottom만 있으면 MAX 앵커 — 부모 크기를 몰라 좌표는 미지정', () => {
    const r = toLayout({ position: 'absolute', right: 2, bottom: 8 });
    expect(r.layout.absolute!.horizontal).toBe('MAX');
    expect(r.layout.absolute!.vertical).toBe('MAX');
    expect(r.warnings.join()).toContain('절대');
  });

  it('position이 없으면 absolute는 undefined', () => {
    expect(toLayout({ top: 4 }).layout.absolute).toBeUndefined();
  });
});

describe('toBox', () => {
  it('backgroundColor를 fills로 변환한다', () => {
    const b = toBox({ backgroundColor: tokens.light.brand[500] }).box;
    expect(b.fills).toHaveLength(1);
    expect(b.fills[0]!.type).toBe('SOLID');
    expect(b.fills[0]!.opacity).toBe(1);
  });

  it('배경이 없으면 fills는 빈 배열 (Figma createFrame 기본 흰 배경 제거)', () => {
    expect(toBox({}).box.fills).toEqual([]);
  });

  it('borderWidth:0 + borderColor:transparent는 유령 스트로크를 만들지 않는다', () => {
    // Button primary의 실제 스타일 — 이걸 그대로 옮기면 없는 테두리가 생긴다
    const b = toBox({ borderWidth: 0, borderColor: 'transparent' }).box;
    expect(b.strokes).toEqual([]);
    expect(b.strokeWeight).toBe(0);
  });

  it('실제 테두리는 strokes로 변환한다', () => {
    const b = toBox({ borderWidth: 1, borderColor: tokens.light.border.subtle }).box;
    expect(b.strokes).toHaveLength(1);
    expect(b.strokeWeight).toBe(1);
  });

  it('borderRadius를 네 모서리에 적용한다', () => {
    expect(toBox({ borderRadius: 8 }).box.cornerRadius).toEqual({ tl: 8, tr: 8, br: 8, bl: 8 });
  });

  it('모서리별 radius가 우선한다 (바텀시트 상단만 둥근 경우)', () => {
    const c = toBox({ borderRadius: 4, borderTopLeftRadius: 16, borderTopRightRadius: 16 }).box;
    expect(c.cornerRadius).toEqual({ tl: 16, tr: 16, br: 4, bl: 4 });
  });

  it("overflow:'hidden'은 clipsContent", () => {
    expect(toBox({ overflow: 'hidden' }).box.clipsContent).toBe(true);
  });

  it('opacity를 그대로 옮긴다', () => {
    expect(toBox({ opacity: 0.5 }).box.opacity).toBe(0.5);
  });

  it('그림자를 DROP_SHADOW로 변환한다 (visible·blendMode 필수)', () => {
    const b = toBox({
      shadowColor: tokens.light.text.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    }).box;
    expect(b.effects).toHaveLength(1);
    const e = b.effects[0]!;
    expect(e.type).toBe('DROP_SHADOW');
    expect(e.offset).toEqual({ x: 0, y: 4 });
    expect(e.visible).toBe(true);
    expect(e.blendMode).toBe('NORMAL');
    expect(e.color.a).toBeCloseTo(0.12, 5);
  });

  it('shadowOpacity가 0이면 그림자를 만들지 않는다 (다크 e1/e2가 이 케이스)', () => {
    const b = toBox({
      shadowColor: tokens.light.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0,
      shadowRadius: 4,
    }).box;
    expect(b.effects).toEqual([]);
  });

  it('elevation만 있고 shadow*가 없으면 근사 그림자 + 경고', () => {
    const r = toBox({ elevation: 4 });
    expect(r.box.effects).toHaveLength(1);
    expect(r.warnings.join()).toContain('elevation');
  });
});

describe('toTextStyle', () => {
  const base = {
    fontFamily: 'PretendardVariable',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
    color: tokens.light.text['on-brand'],
  };

  it('color를 fills로 변환한다 — 누락 시 모든 라벨이 검게 나오는 지점', () => {
    const t = toTextStyle(base).text;
    expect(t.fills).toHaveLength(1);
    expect(t.fills[0]!.color).toEqual({ r: 1, g: 1, b: 1 });
  });

  it('색이 없으면 fills는 빈 배열 (플러그인이 Figma 기본값 유지)', () => {
    expect(toTextStyle({ fontSize: 16 }).text.fills).toEqual([]);
  });

  it('폰트 크기·행간·자간을 옮긴다', () => {
    const t = toTextStyle(base).text;
    expect(t.fontSize).toBe(16);
    expect(t.lineHeight).toBe(24);
    expect(t.letterSpacing).toBe(0);
  });

  it('textAlign을 textAlignHorizontal 값으로 매핑한다', () => {
    expect(toTextStyle({ textAlign: 'center' }).text.textAlign).toBe('CENTER');
    expect(toTextStyle({ textAlign: 'right' }).text.textAlign).toBe('RIGHT');
    expect(toTextStyle({}).text.textAlign).toBe('LEFT');
  });

  it('fontVariant에 tabular-nums가 있으면 플래그를 세운다', () => {
    expect(toTextStyle({ fontVariant: ['tabular-nums'] }).text.tabularNums).toBe(true);
    expect(toTextStyle({ fontVariant: [] }).text.tabularNums).toBe(false);
  });

  it('expo-font 등록 키를 실제 OS 폰트명으로 바꾼다', () => {
    // 'PretendardVariable'는 expo-font 키일 뿐 — Figma에는 'Pretendard Variable'로 설치된다
    expect(toTextStyle(base).text.fontFamily).toBe('Pretendard Variable');
  });
});

describe('fontStyleCandidates', () => {
  it('RN weight를 Figma 스타일 이름으로 매핑한다', () => {
    expect(fontStyleCandidates('400')[0]).toBe('Regular');
    expect(fontStyleCandidates('500')[0]).toBe('Medium');
    expect(fontStyleCandidates('600')[0]).toBe('SemiBold');
    expect(fontStyleCandidates('700')[0]).toBe('Bold');
  });

  it('BrandMark가 쓰는 800도 처리한다 (초안 목록에 없던 weight)', () => {
    expect(fontStyleCandidates('800')[0]).toBe('ExtraBold');
  });

  it("'bold'·'normal' 키워드를 처리한다", () => {
    expect(fontStyleCandidates('bold')[0]).toBe('Bold');
    expect(fontStyleCandidates('normal')[0]).toBe('Regular');
    expect(fontStyleCandidates(undefined)[0]).toBe('Regular');
  });

  it('항상 Regular로 끝나는 폴백 체인을 준다', () => {
    expect(fontStyleCandidates('800')).toContain('Regular');
  });
});

describe('extractMargin', () => {
  it('개별 margin을 뽑는다', () => {
    expect(extractMargin({ marginRight: 8 })).toEqual({ top: 0, right: 8, bottom: 0, left: 0 });
  });

  it('축 지정을 펼친다', () => {
    expect(extractMargin({ marginHorizontal: 16 })).toEqual({
      top: 0,
      right: 16,
      bottom: 0,
      left: 16,
    });
  });

  it('구체 지정이 축·전체를 이긴다', () => {
    expect(extractMargin({ margin: 2, marginVertical: 6, marginTop: 10 })).toEqual({
      top: 10,
      right: 2,
      bottom: 6,
      left: 2,
    });
  });

  it('margin이 없으면 전부 0', () => {
    expect(extractMargin({})).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});

describe('미지원 속성 감지', () => {
  it('화이트리스트에 없는 속성은 경고로 보고한다 (조용한 누락 방지)', () => {
    const r = toLayout({ transform: [{ rotate: '45deg' }] });
    expect(r.warnings.join()).toContain('transform');
  });

  it('알려진 무해한 속성은 경고하지 않는다', () => {
    const r = toLayout({ flexDirection: 'row', gap: 8, paddingTop: 4 });
    expect(r.warnings).toEqual([]);
  });
});
