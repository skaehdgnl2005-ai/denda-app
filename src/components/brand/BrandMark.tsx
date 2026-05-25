// "된다" 워드마크 — 큰 사이즈는 hero (로그인/온보딩), 작은 사이즈는 헤더용.
// brand-500 underbar 액센트로 텍스트 단독보다 시각 무게를 확보 (§17.4).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/design/theme';
import { Title } from '@/design/typography';

export interface BrandMarkProps {
  size?: 'sm' | 'md' | 'lg';
  testID?: string;
}

export const BrandMark: React.FC<BrandMarkProps> = ({ size = 'md', testID }) => {
  const { colors, space } = useTheme();

  const fontSize = size === 'lg' ? 40 : size === 'sm' ? 22 : 32;
  const accentWidth = size === 'lg' ? 28 : size === 'sm' ? 14 : 22;
  const accentHeight = size === 'lg' ? 6 : size === 'sm' ? 3 : 4;
  const gap = size === 'lg' ? space[3] : space[2];

  return (
    <View style={styles.container} testID={testID ?? 'brand-mark'}>
      <View
        accessibilityRole="header"
        accessibilityLabel="된다"
        style={[
          styles.wordmark,
          {
            paddingHorizontal: space[1],
          },
        ]}
      >
        <Title
          level="h1"
          color={colors.text.primary}
          style={{
            fontSize,
            lineHeight: fontSize * 1.1,
            letterSpacing: -fontSize * 0.025,
            fontWeight: '800',
          }}
        >
          된다
        </Title>
      </View>
      <View
        style={{
          width: accentWidth,
          height: accentHeight,
          marginTop: gap,
          borderRadius: accentHeight / 2,
          backgroundColor: colors.brand[500],
        }}
        accessibilityElementsHidden
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
});
