// 지도 점등 전 placeholder (D38).
//
// 네이티브 지도가 켜지기 전(키 미발급 / EAS 빌드 전) 대기창. "준비 중" dead-end 대신
// 작동하는 리스트로 유도(onShowList). 모드별 testID는 기존 화면 테스트와 호환 유지
// (schedule → schedule-map-placeholder, search → map-pending-notice).

import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import type { MapViewMode } from '@/lib/places/MapViewMode';

interface MapPlaceholderProps {
  mode: MapViewMode;
  /** 제공 시 "리스트로 보기" 유도 버튼 노출 → 작동하는 리스트 모드로 전환. */
  onShowList?: () => void;
  testID?: string;
}

const COPY: Record<MapViewMode, { title: string; body: string }> = {
  schedule: {
    title: '지도는 준비 중이에요',
    body: '정식 앱 빌드가 준비되면\n모임 일정을 지도 위에 표시해드릴게요.',
  },
  search: {
    title: '지도는 준비 중이에요',
    body: '정식 앱 빌드가 준비되면\n검색한 장소를 지도 위에 표시해드릴게요.',
  },
};

function defaultTestID(mode: MapViewMode): string {
  return mode === 'schedule' ? 'schedule-map-placeholder' : 'map-pending-notice';
}

export function MapPlaceholder({
  mode,
  onShowList,
  testID,
}: MapPlaceholderProps): React.JSX.Element {
  const { colors, space, radius } = useTheme();
  const copy = COPY[mode];

  return (
    <View
      style={[styles.center, { paddingHorizontal: space[6] }]}
      testID={testID ?? defaultTestID(mode)}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.full,
          backgroundColor: colors.surface[3],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space[3],
        }}
      >
        <Icon name="지도" color={colors.text.secondary} size={26} />
      </View>
      <Body variant="bold" color={colors.text.primary} style={{ marginBottom: space[1] }}>
        {copy.title}
      </Body>
      <Caption
        variant="default"
        color={colors.text.tertiary}
        style={{ textAlign: 'center', lineHeight: 18 }}
      >
        {copy.body}
      </Caption>

      {onShowList ? (
        <Pressable
          onPress={onShowList}
          accessibilityRole="button"
          accessibilityLabel="리스트로 보기"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.listBtn,
            {
              backgroundColor: colors.surface[2],
              borderColor: colors.border.strong,
              borderRadius: radius.pill,
              paddingHorizontal: space[4],
              paddingVertical: space[2],
              marginTop: space[4],
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Caption variant="default" color={colors.text.primary}>
            리스트로 보기
          </Caption>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listBtn: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
