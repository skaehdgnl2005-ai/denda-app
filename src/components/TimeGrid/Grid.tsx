import React from 'react';
import {
  View,
  StyleSheet,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { GestureDetector, type PanGesture } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useTheme } from '../../design/theme';
import type { DayHeader } from '../../lib/datetime/dayHeader';
import { Cell } from './Cell';
import { Header } from './Header';

export interface CellState {
  state: 'empty' | 'self' | 'heat-0' | 'heat-1' | 'heat-2' | 'heat-3' | 'heat-4';
  count: number;
}

export interface GridProps {
  cells: CellState[][]; // 60 rows × N columns (N = colCount, default 7)
  onCellPress?: (slot: number, day: number) => void;
  dayLabels?: string[];
  // W2-5 — 요일+날짜 2줄 헤더. 있으면 dayLabels 대신 사용(요일 caption + 날짜 micro).
  dayHeaders?: DayHeader[];
  testID?: string;
  // D12 worklet drag 통합 — optional.
  // panGesture가 있으면 grid body가 GestureDetector로 감싸지고 single-tap onCellPress는 사용되지 않는다.
  panGesture?: PanGesture;
  // cellWidth 측정 결과 (grid body width / colCount) — 부모가 useSweepGesture의 layout sharedValue에 반영.
  onCellWidthChange?: (cellWidth: number) => void;
  // ScrollView 수직 offset — 부모가 useSweepGesture의 scrollOffsetY sharedValue에 반영.
  onScrollY?: (offsetY: number) => void;
  // 모임 후보 날짜 수 (groups.dates.length). 1~7. 미지정 시 dayLabels.length, 그것도 미지정 시 7.
  colCount?: number;
  // Issue 1A — drag 중 시각 피드백 overlay (SelectionOverlay 등). gridBody 안에
  // absolutely positioned로 mount되어 scroll 같이 됨.
  overlay?: React.ReactNode;
}

const DEFAULT_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const ROW_COUNT = 60;
const TIME_COLUMN_WIDTH = 50; // headerWidth — coords.ts pointToCell과 동일 단위

export const Grid: React.FC<GridProps> = ({
  cells,
  onCellPress,
  dayLabels,
  dayHeaders,
  testID,
  panGesture,
  onCellWidthChange,
  onScrollY,
  colCount,
  overlay,
}) => {
  // 우선순위: colCount prop > dayLabels.length > 7 (백워드 호환)
  const effectiveColCount = colCount ?? dayLabels?.length ?? DEFAULT_DAYS.length;
  const effectiveDayLabels = dayLabels ?? DEFAULT_DAYS.slice(0, effectiveColCount);
  const { colors } = useTheme();

  // Helper to format time label for slot index
  const getTimeLabel = (slotIndex: number): string => {
    if (slotIndex % 4 !== 0) return '';
    const hour = 9 + Math.floor(slotIndex / 4);
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const handleGridBodyLayout = (event: LayoutChangeEvent): void => {
    if (!onCellWidthChange) return;
    const totalWidth = event.nativeEvent.layout.width;
    const cellWidth = (totalWidth - TIME_COLUMN_WIDTH) / effectiveColCount;
    onCellWidthChange(cellWidth);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
    if (!onScrollY) return;
    onScrollY(event.nativeEvent.contentOffset.y);
  };

  const gridBody = (
    <View style={styles.gridBody} onLayout={handleGridBodyLayout}>
      {Array.from({ length: ROW_COUNT }).map((_, slotIdx) => {
        const timeLabel = getTimeLabel(slotIdx);
        const rowCells = cells[slotIdx] || [];

        return (
          <View key={`grid-row-${slotIdx}`} style={styles.row}>
            {/* Time Label on the left */}
            <View style={styles.timeLabelContainer}>
              {timeLabel ? <Header type="time" label={timeLabel} /> : null}
            </View>

            {/* N Day Grid Cells (N = effectiveColCount) */}
            {Array.from({ length: effectiveColCount }).map((_, dayIdx) => {
              const cellData: CellState = rowCells[dayIdx] || {
                state: 'empty',
                count: 0,
              };
              const dh = dayHeaders?.[dayIdx];
              const cellDayLabel = dh ? `${dh.weekday} ${dh.date}` : effectiveDayLabels[dayIdx];

              return (
                <Cell
                  key={`cell-${slotIdx}-${dayIdx}`}
                  state={cellData.state}
                  count={cellData.count}
                  isHeader={false}
                  slotIndex={slotIdx}
                  dayLabel={cellDayLabel}
                  onPress={(): void => {
                    if (onCellPress && !panGesture) {
                      onCellPress(slotIdx, dayIdx);
                    }
                  }}
                  testID={`grid-cell-${slotIdx}-${dayIdx}`}
                />
              );
            })}
          </View>
        );
      })}
      {/* Overlay 마지막 = 가장 위 layer (cells 위에 떠야 drag rect 보임).
          이전엔 cells 앞에 렌더돼 셀 배경에 가려져 첫 칸이 안 보이는 회귀가 있었음 (2026-06-05). */}
      {overlay}
    </View>
  );

  // panGesture가 있으면 GestureDetector로 grid body를 감싼다. ScrollView는 onScroll로
  // scrollOffsetY를 부모에 통지 (부모는 useSweepGesture의 scrollOffsetY sharedValue 갱신).
  const scrollContent = panGesture ? (
    <GestureDetector gesture={panGesture}>{gridBody}</GestureDetector>
  ) : (
    gridBody
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.surface[0] }]} testID={testID}>
      {/* Day Headers (Fixed at the top) */}
      <View style={[styles.headerRow, { borderBottomColor: colors.border.subtle }]}>
        {/* Left Spacer matching time column width */}
        <View style={styles.timeColumnSpacer} />
        {/* Day Header Cells — dayHeaders(요일+날짜 2줄) 우선, 없으면 dayLabels 단일 줄 */}
        {Array.from({ length: effectiveColCount }).map((_, idx) => {
          const dh = dayHeaders?.[idx];
          return (
            <View key={`day-header-${idx}`} style={styles.dayHeaderCellContainer}>
              {dh ? (
                <Header type="day" label={dh.weekday} sublabel={dh.date} />
              ) : (
                <Header type="day" label={effectiveDayLabels[idx] ?? ''} />
              )}
            </View>
          );
        })}
      </View>

      {/* Scrollable TimeGrid Body */}
      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {scrollContent}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    height: 44,
  },
  timeColumnSpacer: {
    width: TIME_COLUMN_WIDTH,
  },
  dayHeaderCellContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  gridBody: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 16, // 14pt visual cell + 2pt vertical margin (Issue 2 bump #2)
  },
  timeLabelContainer: {
    width: TIME_COLUMN_WIDTH,
    height: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
    overflow: 'visible', // allows time header texts to render without cropping
  },
});
