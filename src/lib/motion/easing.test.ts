import { motionEasing } from './easing';
import { tokens } from '@/design/tokens';

describe('motionEasing (§6.2 토큰 대응 함수)', () => {
  test('tokens.easing과 동일한 키 집합을 제공한다', () => {
    expect(Object.keys(motionEasing).sort()).toEqual(Object.keys(tokens.easing).sort());
  });

  test('각 값은 호출 가능한 easing 함수다 (Animated.timing 호환)', () => {
    for (const key of Object.keys(motionEasing) as (keyof typeof motionEasing)[]) {
      expect(typeof motionEasing[key]).toBe('function');
      // easing 함수는 [0,1] 진행률을 받아 숫자를 반환
      expect(typeof motionEasing[key](0)).toBe('number');
      expect(motionEasing[key](0)).toBeCloseTo(0, 5);
      expect(motionEasing[key](1)).toBeCloseTo(1, 5);
    }
  });
});
