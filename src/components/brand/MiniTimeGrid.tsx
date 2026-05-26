// 시간 그리드 미니 데모 — 4×7 셀.
// 정적 그리드 + (옵션) 컬럼 단위 sweep 애니메이션 (피드백 P1 8).
// 사용자 드래그 sweep 메커닉을 시각으로 학습시키는 1.8s 루프.
// reanimated 미설치 (D22 reanimated는 후속 sprint S04 시간 그리드 전용) — setInterval로 구현.

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/design/theme';

const PATTERN: number[][] = [
  // 4 rows × 7 cols. 값 0~4가 heat ramp 인덱스
  [0, 1, 2, 3, 4, 3, 1],
  [1, 2, 3, 4, 4, 3, 2],
  [0, 1, 3, 4, 3, 2, 1],
  [0, 1, 2, 3, 2, 1, 0],
];

export interface MiniTimeGridProps {
  cellSize?: number;
  gap?: number;
  /** 손가락 sweep 애니메이션 활성화 — 온보딩에서 true */
  animated?: boolean;
  testID?: string;
}

export const MiniTimeGrid: React.FC<MiniTimeGridProps> = ({
  cellSize = 28,
  gap = 3,
  animated = false,
  testID,
}) => {
  const { colors, radius } = useTheme();
  const cols = PATTERN[0]!.length;
  // 초기는 cols(다 채움) — 첫 frame이 의미 있게 보임.
  // animated=true면 짧은 delay 후 sweep cycle 시작.
  const [sweep, setSweep] = useState(cols);

  useEffect(() => {
    if (!animated) {
      // animated false 토글 시 sweep state를 cols로 reset — prop 변화 응답
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSweep(cols);
      return;
    }
    const initialHold = 1200; // 가득 찬 상태로 잠시 머무름
    const step = 220; // 컬럼당 220ms
    const reset = 600;
    let timer: ReturnType<typeof setTimeout>;
    let current = -1;
    const tick = () => {
      current += 1;
      setSweep(current);
      if (current >= cols) {
        timer = setTimeout(() => {
          current = -1;
          setSweep(-1);
          timer = setTimeout(tick, step);
        }, reset);
      } else {
        timer = setTimeout(tick, step);
      }
    };
    timer = setTimeout(() => {
      setSweep(-1);
      timer = setTimeout(tick, step);
    }, initialHold);
    return () => clearTimeout(timer);
  }, [animated, cols]);

  return (
    <View style={styles.container} testID={testID ?? 'mini-time-grid'}>
      {PATTERN.map((row, rowIdx) => (
        <View
          key={rowIdx}
          style={[styles.row, { marginBottom: rowIdx < PATTERN.length - 1 ? gap : 0 }]}
        >
          {row.map((heatIdx, colIdx) => {
            const filled = colIdx <= sweep;
            return (
              <View
                key={colIdx}
                style={{
                  width: cellSize,
                  height: cellSize,
                  marginRight: colIdx < row.length - 1 ? gap : 0,
                  borderRadius: radius.sm,
                  backgroundColor: filled ? colors.heat[heatIdx]! : colors.surface[3],
                }}
                accessibilityElementsHidden
              />
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
});
