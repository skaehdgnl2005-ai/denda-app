// 눌림(pressed) 배경색 순수 헬퍼 (W2-8, §9.1 pressed=surface / §17.1 CTA).
// opacity 딤 대신 surface·brand 한 단계 색 전환으로 "토스 풍" 절제된 press 피드백.
// 색 결정은 토큰만 참조 — 화면 인라인 style에서 반복하던 규칙을 단일 계약으로 분리
// (light/dark 양쪽 계약 테스트, press.test.ts).
// 제외: Cell(60fps/D12 worklet 경로)·카톡 버튼(외부 브랜드색)·아이콘 전용 버튼(opacity 유지).
import type { useTheme } from '@/design/theme';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

/**
 * 행·카드 pressed 배경. pressed면 surface-3(눌림 톤), 아니면 base(기본 'transparent').
 * 카드 자체 배경이 있으면 base로 그 색을 넘긴다 (미press 시 그대로 유지).
 */
export function rowPressBg(
  pressed: boolean,
  colors: ThemeColors,
  base: string = 'transparent',
): string {
  return pressed ? colors.surface[3] : base;
}

/**
 * brand fill CTA pressed 배경. pressed면 brand-600, 아니면 brand-500.
 * 라이트=한 단계 진하게 / 다크=한 단계 밝게 — 두 모드 모두 눌림이 보인다.
 */
export function ctaPressBg(pressed: boolean, colors: ThemeColors): string {
  return pressed ? colors.brand[600] : colors.brand[500];
}
