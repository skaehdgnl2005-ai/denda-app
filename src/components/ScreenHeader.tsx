// 공용 화면 헤더 (W0-5). 10개 화면의 수제 topBar를 대체 — 뒤로 화살표 방향 오류
// (privacy가 오른쪽 화살표로 렌더되던 결함)의 원천을 '뒤로'(chevron-left) 하나로 통일.
// 좌: 뒤로(44pt) 또는 spacer / 중앙: title-3 / 우: 액션 슬롯 또는 44pt spacer.
// inset space-4, 수직 space-3. 토큰만 사용.
import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Title } from '@/design/typography';

const HIT = 44;

export interface ScreenHeaderProps {
  title?: string;
  /** 있으면 좌측에 뒤로 버튼 표시 (예: () => router.back()) */
  onBack?: () => void;
  /** 우측 액션 슬롯 (더보기·편집 등). 없으면 44pt spacer로 타이틀 중앙 정렬 유지 */
  right?: React.ReactNode;
  testID?: string;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, onBack, right, testID }) => {
  const { colors, space } = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: space[4],
        paddingVertical: space[3],
        backgroundColor: colors.surface[0],
      }}
    >
      {onBack ? (
        <Pressable
          testID={testID ? `${testID}-back` : undefined}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          style={{ width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="뒤로" color={colors.text.primary} size={24} />
        </Pressable>
      ) : (
        <View style={{ width: HIT, height: HIT }} />
      )}

      <Title level="h3" color={colors.text.primary} style={{ flex: 1, textAlign: 'center' }}>
        {title ?? ''}
      </Title>

      {right ? (
        <View
          style={{ minWidth: HIT, height: HIT, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          {right}
        </View>
      ) : (
        <View style={{ width: HIT, height: HIT }} />
      )}
    </View>
  );
};
