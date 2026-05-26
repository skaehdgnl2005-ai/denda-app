// classifyHeat — votes count → 5-stop heat 분류 (D10).
//
// RN src/lib/heatmap/classify.ts와 정확히 동일 spec. S14↔S05 spec drift 방지 (D23 Conflict flag).
//
// 분기 (1 ≤ count ≤ maxCount 가정, quartile 기준):
//   count ≤ maxCount/4 → heat-1
//   maxCount/4 < count ≤ maxCount/2 → heat-2
//   maxCount/2 < count ≤ 3·maxCount/4 → heat-3
//   3·maxCount/4 < count ≤ maxCount → heat-4
//
// Edge cases (graceful clamp):
//   - count ≤ 0 → heat-0
//   - maxCount ≤ 0 (멤버 없는 모임) → heat-0
//   - count ≥ maxCount → heat-4

export type HeatLevel = 'heat-0' | 'heat-1' | 'heat-2' | 'heat-3' | 'heat-4';

export function classifyHeat(count: number, maxCount: number): HeatLevel {
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

// heatToTokenIndex — heat-N → tokens.heat[index] 매핑.
// tokens.heat (lib/tokens.ts) 배열 인덱스 0~4와 정확히 정합.
export function heatToTokenIndex(level: HeatLevel): 0 | 1 | 2 | 3 | 4 {
  switch (level) {
    case 'heat-0':
      return 0;
    case 'heat-1':
      return 1;
    case 'heat-2':
      return 2;
    case 'heat-3':
      return 3;
    case 'heat-4':
      return 4;
  }
}
