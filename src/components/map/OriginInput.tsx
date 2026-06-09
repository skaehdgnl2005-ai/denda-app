// S-MAP M3 — 출발지 입력 (Q-B23).
//
// 자동완성 = 장소 검색 재사용(useMapSearch → NaverSearchProvider). 최근 출발지 2개는 칩으로
// 빠른 선택. 검색 결과/칩 선택 시 onSelect({label, coord})로 출발지를 부모(중간지점 화면)에
// 올린다. 본 컴포넌트는 화면 무상태 — origins 누적·저장은 부모 책임.
//
// 한국어 only · DESIGN 토큰 · §17 anti-AI-feel (brand-500 fill 0 — 입력·칩·결과 tap이 action).

import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import type { OriginPoint } from '@/lib/map/midpoint';
import type { PlaceSearchProvider } from '@/lib/places/PlaceSearchProvider';
import { useMapSearch } from '@/lib/places/useMapSearch';

interface OriginInputProps {
  recentOrigins: OriginPoint[];
  onSelect: (origin: OriginPoint) => void;
  /** 검색 provider (DI). 기본 NaverSearchProvider. */
  provider?: PlaceSearchProvider;
  placeholder?: string;
}

export function OriginInput({
  recentOrigins,
  onSelect,
  provider,
  placeholder = '출발지 검색 (지하철역·동네)',
}: OriginInputProps): React.JSX.Element {
  const { colors, space, radius } = useTheme();
  const { query, setQuery, results, isLoading } = useMapSearch({ provider });

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.surface[2],
          borderRadius: radius.md,
          paddingHorizontal: space[3],
        }}
      >
        <Icon name="검색" color={colors.text.tertiary} size={20} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.text.disabled}
          testID="origin-search-input"
          returnKeyType="search"
          style={{
            flex: 1,
            marginLeft: space[2],
            paddingVertical: space[3],
            color: colors.text.primary,
            fontFamily: 'PretendardVariable',
            fontSize: 16,
          }}
        />
      </View>

      {recentOrigins.length > 0 ? (
        <View style={styles.chipRow}>
          {recentOrigins.map((origin, index) => (
            <Pressable
              key={`recent-${index}`}
              onPress={() => onSelect(origin)}
              accessibilityRole="button"
              accessibilityLabel={`최근 출발지 ${origin.label}`}
              testID={`recent-origin-chip-${index}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.surface[2],
                borderRadius: radius.pill,
                paddingHorizontal: space[3],
                paddingVertical: space[2],
                marginRight: space[2],
                marginTop: space[2],
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="장소" color={colors.text.tertiary} size={14} />
              <Caption color={colors.text.primary} style={{ marginLeft: space[1] }}>
                {origin.label}
              </Caption>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: space[1], paddingTop: space[3] }}>
          <Caption color={colors.text.tertiary}>출발지를 찾고 있어요...</Caption>
        </View>
      ) : null}

      {results.map((item, index) => (
        <Pressable
          key={item.providerPlaceId}
          onPress={() => onSelect({ label: item.name, coord: { lat: item.lat, lng: item.lng } })}
          accessibilityRole="button"
          accessibilityLabel={`${item.name} 출발지로 선택`}
          testID={`origin-result-${index}`}
          style={({ pressed }) => ({
            backgroundColor: colors.surface[1],
            borderRadius: radius.md,
            padding: space[3],
            marginTop: space[2],
            borderWidth: 1,
            borderColor: colors.border.subtle,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Body variant="bold" color={colors.text.primary} numberOfLines={1}>
            {item.name}
          </Body>
          {item.address !== null && item.address.length > 0 ? (
            <Caption
              color={colors.text.secondary}
              style={{ marginTop: space[1] }}
              numberOfLines={1}
            >
              {item.address}
            </Caption>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
});
