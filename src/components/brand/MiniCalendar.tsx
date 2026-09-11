// 캘린더 미니 데모 (5×7 그리드 + brand-500 highlighted day).
// 온보딩 슬라이드 3에 사용 — "캘린더에 자동 추가" 가치 prop 시각화.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

const HIGHLIGHT_INDEX = 17; // 3rd row, 4th col area

export interface MiniCalendarProps {
  cellSize?: number;
  gap?: number;
  testID?: string;
}

export const MiniCalendar: React.FC<MiniCalendarProps> = ({ cellSize = 28, gap = 4, testID }) => {
  const { colors, radius, space } = useTheme();

  return (
    <View style={styles.container} testID={testID ?? 'mini-calendar'}>
      <View style={[styles.row, { marginBottom: space[2] }]}>
        {DAYS.map((d, i) => (
          <Caption
            key={i}
            variant="micro"
            color={i >= 5 ? colors.text.tertiary : colors.text.secondary}
            style={{
              width: cellSize,
              marginRight: i < DAYS.length - 1 ? gap : 0,
              textAlign: 'center',
            }}
          >
            {d}
          </Caption>
        ))}
      </View>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <View key={rowIdx} style={[styles.row, { marginBottom: rowIdx < 4 ? gap : 0 }]}>
          {Array.from({ length: 7 }).map((__, colIdx) => {
            const idx = rowIdx * 7 + colIdx;
            const day = idx - 2; // offset so first row has 5 empty days
            const visible = day > 0 && day <= 31;
            const highlighted = idx === HIGHLIGHT_INDEX;
            return (
              <View
                key={colIdx}
                style={{
                  width: cellSize,
                  height: cellSize,
                  marginRight: colIdx < 6 ? gap : 0,
                  borderRadius: radius.sm,
                  backgroundColor: highlighted ? colors.brand[500] : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {visible ? (
                  <Body
                    variant="sm"
                    color={
                      highlighted
                        ? colors.text['on-brand']
                        : colIdx >= 5
                          ? colors.text.tertiary
                          : colors.text.secondary
                    }
                    tabularNums
                    style={{ fontWeight: highlighted ? '700' : '400' }}
                  >
                    {day}
                  </Body>
                ) : null}
              </View>
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
