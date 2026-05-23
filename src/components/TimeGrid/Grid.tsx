import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '../../design/theme';
import { Cell } from './Cell';
import { Header } from './Header';

export interface CellState {
  state: 'empty' | 'self' | 'heat-0' | 'heat-1' | 'heat-2' | 'heat-3' | 'heat-4';
  count: number;
}

export interface GridProps {
  cells: CellState[][]; // 60 rows × 7 columns
  onCellPress?: (slot: number, day: number) => void;
  dayLabels?: string[];
  testID?: string;
}

const DEFAULT_DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const ROW_COUNT = 60;
const COL_COUNT = 7;

export const Grid: React.FC<GridProps> = ({
  cells,
  onCellPress,
  dayLabels = DEFAULT_DAYS,
  testID,
}) => {
  const { colors, space } = useTheme();

  // Helper to format time label for slot index
  const getTimeLabel = (slotIndex: number): string => {
    if (slotIndex % 4 !== 0) return '';
    const hour = 9 + Math.floor(slotIndex / 4);
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface[0] }]} testID={testID}>
      {/* Day Headers (Fixed at the top) */}
      <View style={[styles.headerRow, { borderBottomColor: colors.border.subtle }]}>
        {/* Left Spacer matching time column width */}
        <View style={styles.timeColumnSpacer} />
        {/* Day Header Cells */}
        {dayLabels.map((day, idx) => (
          <View key={`day-header-${idx}`} style={styles.dayHeaderCellContainer}>
            <Header type="day" label={day} />
          </View>
        ))}
      </View>

      {/* Scrollable TimeGrid Body */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gridBody}>
          {Array.from({ length: ROW_COUNT }).map((_, slotIdx) => {
            const timeLabel = getTimeLabel(slotIdx);
            const rowCells = cells[slotIdx] || [];

            return (
              <View key={`grid-row-${slotIdx}`} style={styles.row}>
                {/* Time Label on the left */}
                <View style={styles.timeLabelContainer}>
                  {timeLabel ? <Header type="time" label={timeLabel} /> : null}
                </View>

                {/* 7 Day Grid Cells */}
                {Array.from({ length: COL_COUNT }).map((_, dayIdx) => {
                  const cellData: CellState = rowCells[dayIdx] || {
                    state: 'empty',
                    count: 0,
                  };

                  return (
                    <Cell
                      key={`cell-${slotIdx}-${dayIdx}`}
                      state={cellData.state}
                      count={cellData.count}
                      isHeader={false}
                      onPress={(): void => {
                        if (onCellPress) {
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
        </View>
      </ScrollView>
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
    width: 50,
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
    height: 10, // 8pt visual cell + 2pt space
  },
  timeLabelContainer: {
    width: 50,
    height: 10,
    justifyContent: 'center',
    alignItems: 'flex-end',
    overflow: 'visible', // allows time header texts to render without cropping
  },
});
