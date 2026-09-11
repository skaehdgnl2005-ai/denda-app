// 제휴 식당 배지 (S-MAP M4, DESIGN §10.2 / §12.6).
//
// 리스트 행·카드(바텀시트)에서 제휴 식당을 시각화하는 재사용 pill.
// §12.6 색 단독 의존 금지 → brand 색 + "제휴" 텍스트 라벨 + 아이콘 = 3중 신호.
// ② 제휴 = Phase 3(D3) 데이터 경계: 본 컴포넌트는 순수 시각 capability(데이터 소스는
// isResultPartner stub / partnership_id 기존 스키마 플래그). 색은 DESIGN 토큰만.

import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Caption } from '@/design/typography';

interface PartnerBadgeProps {
  testID?: string;
}

export function PartnerBadge({ testID }: PartnerBadgeProps): React.JSX.Element {
  const { colors, space, radius } = useTheme();

  return (
    <View
      testID={testID ?? 'partner-badge'}
      accessibilityLabel="제휴 식당"
      style={[
        styles.badge,
        {
          backgroundColor: colors.brand[50],
          borderRadius: radius.pill,
          paddingHorizontal: space[2],
          paddingVertical: space['0.5'],
          gap: space[1],
        },
      ]}
    >
      <View testID="partner-badge-icon">
        <Icon name="제휴" color={colors.brand[500]} size={13} />
      </View>
      <Caption variant="micro" color={colors.brand[500]}>
        제휴
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
