// classifyHeat — votes count → 5-stop heat 분류.
//
// D10: 5-stop ramp (heat-0 ~ heat-4). heat-0 = 빈 슬롯 (count=0).
// maxCount는 group_members 인원 — 분포 정규화에 사용.
//
// 분기 (1 ≤ count ≤ maxCount 가정):
//   count ≤ maxCount/4 → heat-1
//   maxCount/4 < count ≤ maxCount/2 → heat-2
//   maxCount/2 < count ≤ 3·maxCount/4 → heat-3
//   3·maxCount/4 < count ≤ maxCount → heat-4
//
// Edge cases (graceful):
//   - count < 0 → heat-0 (이상치 clamp)
//   - count = 0 → heat-0
//   - count > maxCount → heat-4 (이상치 clamp)
//   - maxCount = 0 → heat-0 (멤버 없는 모임)

import type { CellStateKind } from './types';

export function classifyHeat(count: number, maxCount: number): CellStateKind {
  if (count <= 0 || maxCount <= 0) return 'heat-0';
  if (count >= maxCount) return 'heat-4';

  const q1 = maxCount / 4;
  const q2 = maxCount / 2;
  const q3 = (3 * maxCount) / 4;

  if (count <= q1) return 'heat-1';
  if (count <= q2) return 'heat-2';
  if (count <= q3) return 'heat-3';
  return 'heat-4';
}
