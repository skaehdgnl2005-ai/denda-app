// W2-1 탭바 순수 헬퍼 계약 테스트 (safe area · focused 2차 신호 · FAB 오프셋).
import { fabBottomOffset, focusedTabFill, tabBarHeightStyle } from '@/lib/nav/tabBar';
import { tokens } from '@/design/tokens';

const S2 = tokens.space[2]; // 8
const S4 = tokens.space[4]; // 16

describe('tabBarHeightStyle (W2-1 safe area)', () => {
  test('노치 기기(insets.bottom=34): 높이 64+34, paddingBottom 34, paddingTop space-2', () => {
    const s = tabBarHeightStyle(34);
    expect(s.height).toBe(64 + 34);
    expect(s.paddingBottom).toBe(34);
    expect(s.paddingTop).toBe(S2);
  });

  test('비노치(insets.bottom=0): paddingBottom는 space-2 바닥 유지, 높이 64', () => {
    const s = tabBarHeightStyle(0);
    expect(s.height).toBe(64);
    expect(s.paddingBottom).toBe(S2);
    expect(s.paddingTop).toBe(S2);
  });

  test('작은 inset(4)도 space-2 바닥으로 클램프', () => {
    expect(tabBarHeightStyle(4).paddingBottom).toBe(S2);
  });
});

describe('focusedTabFill (W2-1 focused 2차 신호)', () => {
  test('focused면 tint로 채움, 아니면 undefined(아웃라인)', () => {
    const tint = tokens.light.brand[500];
    expect(focusedTabFill(true, tint)).toBe(tint);
    expect(focusedTabFill(false, tint)).toBeUndefined();
  });
});

describe('fabBottomOffset (W2-3 FAB 배치)', () => {
  test('탭바 높이 + space-4(16) 위로 띄움', () => {
    expect(fabBottomOffset(34)).toBe(64 + 34 + S4);
    expect(fabBottomOffset(0)).toBe(64 + S4);
  });
});
