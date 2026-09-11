// 시간 그리드 투표 안내 + 히트맵 범례 (DESIGN §11.2 ghost text + §4.3 색맹 라벨).
// 첫 진입(선택 0) → 드래그 사용법 강조. 선택 시작 후 → 범례만 컴팩트 유지.
// 토큰만 사용 (hex 금지) · 한국어 only.
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { HeatRampRow } from '@/components/brand/HeatRampRow';
import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';

export interface VoteGuideProps {
  /** 본인이 칠한 슬롯이 1개 이상인지 */
  hasSelection: boolean;
  testID?: string;
}

export const VoteGuide: React.FC<VoteGuideProps> = ({ hasSelection, testID }) => {
  const { colors, space, radius } = useTheme();

  return (
    <View
      testID={testID ?? 'vote-guide'}
      style={[
        styles.container,
        {
          backgroundColor: colors.surface[2],
          borderRadius: radius.md,
          padding: space[3],
        },
      ]}
    >
      {!hasSelection ? (
        <View style={[styles.headlineRow, { marginBottom: space[3] }]}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: colors.brand[50], borderRadius: radius.full },
            ]}
          >
            <Icon name="시간" color={colors.brand[500]} size={18} />
          </View>
          <View style={{ flex: 1, marginLeft: space[3] }}>
            <Body variant="bold" color={colors.text.primary}>
              시간 위를 꾹 눌러 쓸어보세요
            </Body>
            <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: 2 }}>
              칠한 칸이 내가 가능한 시간이에요.
            </Caption>
          </View>
        </View>
      ) : null}

      {/* 히트맵 범례 — 색 단독 의존 금지(§4.3): 텍스트 라벨 동반 */}
      <View style={styles.legendRow}>
        <HeatRampRow cellSize={14} cellGap={3} testID="vote-guide-ramp" />
        <Caption
          variant="default"
          color={colors.text.secondary}
          style={{ marginLeft: space[2], flex: 1 }}
        >
          가능 인원이 많을수록 진해져요
        </Caption>
      </View>

      {/* 본인 선택 표식 범례 */}
      <View style={[styles.legendRow, { marginTop: space[2] }]}>
        <View
          style={[
            styles.selfSwatch,
            {
              backgroundColor: colors.brand[50],
              borderColor: colors.brand[500],
              borderRadius: radius.sm,
            },
          ]}
        />
        <Caption
          variant="default"
          color={colors.text.secondary}
          style={{ marginLeft: space[2], flex: 1 }}
        >
          보라 테두리 = 내가 고른 시간
        </Caption>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBubble: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selfSwatch: {
    width: 16,
    height: 16,
    borderWidth: 2,
  },
});
