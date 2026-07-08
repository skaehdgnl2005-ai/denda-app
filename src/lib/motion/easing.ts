// DESIGN §6.2 easing 토큰의 RN Animated 대응 함수 (W0 리뷰 후속).
// tokens.easing.*는 CSS cubic-bezier 문자열이라 Animated.timing(EasingFunction 필요)에
// 직접 쓸 수 없다 → 동일 bezier를 Easing.bezier(...)로 제공해 "easing은 tokens.easing.*만"
// 규칙을 코드에서 실제로 지킨다. 문자열 토큰과 이 함수 테이블은 같은 곡선이어야 한다.
import { Easing, type EasingFunction } from 'react-native';

export const motionEasing: Record<'standard' | 'enter' | 'exit' | 'emphasized', EasingFunction> = {
  standard: Easing.bezier(0.4, 0.0, 0.2, 1), // tokens.easing.standard
  enter: Easing.bezier(0.0, 0.0, 0.2, 1), // tokens.easing.enter
  exit: Easing.bezier(0.4, 0.0, 1.0, 1), // tokens.easing.exit
  emphasized: Easing.bezier(0.2, 0.0, 0.0, 1.0), // tokens.easing.emphasized
};
