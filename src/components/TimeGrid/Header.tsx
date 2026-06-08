import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../design/theme';
import { Caption } from '../../design/typography';

export interface HeaderProps {
  type: 'day' | 'time';
  label: string;
  testID?: string;
}

export const Header: React.FC<HeaderProps> = ({ type, label, testID }) => {
  const { colors } = useTheme();

  if (type === 'day') {
    return (
      <View style={styles.dayContainer} testID={testID}>
        <Caption
          variant="default"
          color={colors.text.secondary}
          allowFontScaling={false}
          style={styles.dayText}
        >
          {label}
        </Caption>
      </View>
    );
  }

  // Time header
  return (
    <View style={styles.timeContainer} testID={testID}>
      <Caption
        variant="micro"
        color={colors.text.tertiary}
        tabularNums
        allowFontScaling={false}
        style={styles.timeText}
      >
        {label}
      </Caption>
    </View>
  );
};

const styles = StyleSheet.create({
  dayContainer: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayText: {
    fontWeight: '600',
  },
  timeContainer: {
    // height 32였을 때 row(16)를 넘어서 시간라벨이 위·아래 셀과 겹쳐 정렬이 어긋나
    // 보이는 회귀 (2026-06-08). row와 같은 16으로 맞춰서 셀들과 한 줄에 정렬.
    height: 16,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  timeText: {
    fontWeight: '500',
  },
});
