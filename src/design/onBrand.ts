// brand fill(브랜드 채움) 위 콘텐츠용 반투명 베일 색 (W3-4).
// 라이트=on-brand(흰색)·다크=on-brand(근검정) 기반 rgba를 생성한다.
// 흰색 rgba 하드코딩(rgba(255,255,255,x))은 다크 brand fill(밝은 보라) 위에서 대비가 무너지므로
// on-brand 토큰만 참조해 두 모드 모두 가독성을 유지한다 (색 하드코딩 금지).
import type { useTheme } from '@/design/theme';

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/** brand fill 위 텍스트·칩용 반투명 on-brand 색. alpha 0~1. */
export function onBrandVeil(colors: ThemeColors, alpha: number): string {
  const { r, g, b } = hexToRgb(colors.text['on-brand']);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
