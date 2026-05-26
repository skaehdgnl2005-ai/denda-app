// 지도 탭 placeholder — Phase 1+2 후속 sprint에서 Naver Maps 통합.

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';

export default function MapScreen() {
  const { colors, space, radius } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <View
        style={{
          paddingHorizontal: space[4],
          paddingTop: space[4],
          paddingBottom: space[3],
        }}
      >
        <Title level="h1" color={colors.text.primary}>
          지도
        </Title>
      </View>
      <View style={styles.center}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.full,
            backgroundColor: colors.surface[2],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space[3],
          }}
        >
          <Icon name="지도" color={colors.text.secondary} size={26} />
        </View>
        <Body variant="bold" color={colors.text.primary} style={{ marginBottom: space[1] }}>
          모임 장소를 지도로 봐요
        </Body>
        <Caption
          variant="default"
          color={colors.text.tertiary}
          style={{ textAlign: 'center', lineHeight: 18, paddingHorizontal: space[6] }}
        >
          모임이 확정되면 위치가 표시되고,{'\n'}내 동선도 함께 볼 수 있어요.
        </Caption>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
