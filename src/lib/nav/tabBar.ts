// (tabs) 탭바 레이아웃 순수 헬퍼 (W2-1). safe area·focused 2차 신호를 화면 밖에서
// 결정적으로 단위 테스트하기 위해 분리 (buttonPalette 패턴). 토큰만 참조.
import { tokens } from '@/design/tokens';

const BASE_TAB_HEIGHT = 64;

export interface TabBarHeightStyle {
  height: number;
  paddingTop: number;
  paddingBottom: number;
}

/**
 * iOS 홈 인디케이터 safe area 반영(§12.7). 노치 기기는 insets.bottom만큼 확장하고
 * paddingBottom도 그만큼. 비노치(insets.bottom=0)는 space-2(8pt) 바닥을 유지해
 * 라벨이 화면 끝에 붙지 않게 한다.
 */
export function tabBarHeightStyle(insetsBottom: number): TabBarHeightStyle {
  const floor = tokens.space[2];
  return {
    height: BASE_TAB_HEIGHT + insetsBottom,
    paddingTop: floor,
    paddingBottom: Math.max(insetsBottom, floor),
  };
}

/**
 * focused 탭의 '채움' 2차 신호(§12.6 색 단독 의존 금지) — 활성 아이콘을 tint로 채워
 * 아웃라인→솔리드로 전환. 비활성은 undefined(아웃라인 유지).
 */
export function focusedTabFill(focused: boolean, tint: string): string | undefined {
  return focused ? tint : undefined;
}

/** GroupFab을 탭바 위 space-4(16pt) 띄워 중앙 배치할 bottom 오프셋. */
export function fabBottomOffset(insetsBottom: number): number {
  return tabBarHeightStyle(insetsBottom).height + tokens.space[4];
}
