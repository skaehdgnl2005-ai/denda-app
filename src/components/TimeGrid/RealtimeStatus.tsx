import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../design/theme';
import { Caption } from '../../design/typography';
import { Info } from 'lucide-react-native';

export interface RealtimeStatusProps {
  isConnected: boolean;
  testID?: string;
}

export const RealtimeStatus: React.FC<RealtimeStatusProps> = ({ isConnected, testID }) => {
  const { colors, space, radius } = useTheme();

  if (isConnected) {
    return null;
  }

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: colors.semantic.info.bg,
          borderColor: colors.semantic.info.border,
          borderRadius: radius.pill,
          paddingHorizontal: space[3],
          paddingVertical: space[2],
        },
      ]}
      testID={testID}
      accessibilityRole="alert"
      accessibilityLabel="실시간 갱신 일시 중단 — 30초 후 폴링"
    >
      <Info size={14} color={colors.semantic.info.fg} strokeWidth={2} style={styles.icon} />
      <Caption
        variant="micro"
        color={colors.semantic.info.fg}
        allowFontScaling={true}
        style={styles.text}
      >
        실시간 갱신 일시 중단 — 30s 후 폴링
      </Caption>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    alignSelf: 'center',
    marginVertical: 8,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontWeight: '600',
  },
});
