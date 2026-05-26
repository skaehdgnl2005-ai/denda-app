// classifyHeat — D10 5-stop ramp 분류 (count → heat-0 ~ heat-4).
// 빈 슬롯 (count=0) = heat-0(중립 그레이). 1~maxCount는 4분할.
// maxCount=0 또는 maxCount<count(이상치) edge case 명시.

import { classifyHeat } from './classify';

describe('classifyHeat — D10 5-stop ramp', () => {
  test('count=0 → heat-0 (빈 슬롯, 중립 그레이)', () => {
    expect(classifyHeat(0, 7)).toBe('heat-0');
  });

  test('maxCount=7 기준 1~7 분포', () => {
    // 분기 경계: maxCount/4=1.75, /2=3.5, 3/4=5.25, max=7
    expect(classifyHeat(1, 7)).toBe('heat-1'); // 0 < 1 ≤ 1.75
    expect(classifyHeat(2, 7)).toBe('heat-2'); // 1.75 < 2 ≤ 3.5
    expect(classifyHeat(3, 7)).toBe('heat-2'); // 1.75 < 3 ≤ 3.5
    expect(classifyHeat(4, 7)).toBe('heat-3'); // 3.5 < 4 ≤ 5.25
    expect(classifyHeat(5, 7)).toBe('heat-3'); // 3.5 < 5 ≤ 5.25
    expect(classifyHeat(6, 7)).toBe('heat-4'); // 5.25 < 6 ≤ 7
    expect(classifyHeat(7, 7)).toBe('heat-4');
  });

  test('maxCount=0 → 항상 heat-0 (멤버 없는 모임 edge case)', () => {
    expect(classifyHeat(0, 0)).toBe('heat-0');
    expect(classifyHeat(3, 0)).toBe('heat-0');
  });

  test('count > maxCount (이상치) → heat-4로 clamp', () => {
    // 게스트가 멤버 수 초과해도 안전 graceful
    expect(classifyHeat(10, 7)).toBe('heat-4');
  });

  test('count < 0 (이상치) → heat-0으로 clamp', () => {
    expect(classifyHeat(-1, 7)).toBe('heat-0');
  });

  test('maxCount=1 (2인 모임 본인 1명 + 상대 1명 합산 시) — 0,1만 가능', () => {
    expect(classifyHeat(0, 1)).toBe('heat-0');
    expect(classifyHeat(1, 1)).toBe('heat-4'); // 가득 = 전원 합의
  });

  test('maxCount=4 분포', () => {
    // 분기: /4=1, /2=2, 3/4=3, max=4
    expect(classifyHeat(1, 4)).toBe('heat-1');
    expect(classifyHeat(2, 4)).toBe('heat-2');
    expect(classifyHeat(3, 4)).toBe('heat-3');
    expect(classifyHeat(4, 4)).toBe('heat-4');
  });
});
