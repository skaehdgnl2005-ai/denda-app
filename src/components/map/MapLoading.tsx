// 지도 lazy 로드 중 Suspense fallback (D38).

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '@/design/theme';

export function MapLoading(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={styles.center} testID="map-loading">
      <ActivityIndicator color={colors.brand[500]} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
