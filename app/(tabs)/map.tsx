// 지도 탭 — 장소 검색 데이터 레이어 wire (S10).
//
// 검색·필터·클러스터링 데이터는 useMapSearch(D26 debounce + 5분 격자 캐시 + Naver fallback)로
// 동작. 네이티브 지도 렌더(@mj-studio/react-native-naver-map)·제휴 마커 PNG·실기기 검증은
// EAS Build 운영 트랙(S13)이라 본 화면은 검색 결과를 리스트로 표시 + "지도 준비 중" 안내.
// MapView unblock 시: 리스트 자리를 <NaverMapView>로 교체 + 결과를 마커로 그림(clusterByGrid),
// 마커 onPress → router.push('/group/[id]/place')(S08 PlaceActionSheet wire).

import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { useMapSearch } from '@/lib/places/useMapSearch';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';

export default function MapScreen(): React.JSX.Element {
  const { colors, space, radius } = useTheme();
  const { query, setQuery, results, isLoading, error } = useMapSearch();

  const hasQuery = query.trim().length > 0;

  const renderItem = ({ item }: { item: PlaceSearchResult }): React.JSX.Element => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface[1],
          borderColor: colors.border.subtle,
          borderRadius: radius.lg,
          padding: space[4],
          marginBottom: space[3],
        },
      ]}
      testID="map-result-card"
    >
      <View
        style={[
          styles.cardIcon,
          { backgroundColor: colors.surface[3], borderRadius: radius.full, marginRight: space[3] },
        ]}
      >
        <Icon name="장소" color={colors.text.secondary} size={20} />
      </View>
      <View style={styles.cardBody}>
        <Body variant="bold" color={colors.text.primary}>
          {item.name}
        </Body>
        {item.category ? (
          <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: 2 }}>
            {item.category}
          </Caption>
        ) : null}
        {item.address ? (
          <Body variant="sm" color={colors.text.secondary} style={{ marginTop: space[1] }}>
            {item.address}
          </Body>
        ) : null}
      </View>
    </View>
  );

  const renderResults = (): React.JSX.Element => {
    if (isLoading) {
      return (
        <View style={styles.center} testID="map-search-loading">
          <ActivityIndicator color={colors.brand[500]} size="large" />
        </View>
      );
    }
    if (error !== null) {
      return (
        <View style={[styles.center, { paddingHorizontal: space[6] }]} testID="map-search-error">
          <Icon name="장소" color={colors.text.tertiary} size={26} />
          <Body
            variant="sm"
            color={colors.text.secondary}
            style={{ marginTop: space[3], textAlign: 'center' }}
          >
            {error}
          </Body>
        </View>
      );
    }
    if (!hasQuery) {
      return (
        <View style={[styles.center, { paddingHorizontal: space[6] }]} testID="map-initial-state">
          <Body variant="bold" color={colors.text.primary} style={{ marginBottom: space[1] }}>
            가고 싶은 곳을 검색해요
          </Body>
          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ textAlign: 'center', lineHeight: 18 }}
          >
            식당·카페 이름이나 지역을 입력하면{'\n'}모임 장소 후보를 찾아드려요.
          </Caption>
        </View>
      );
    }
    if (results.length === 0) {
      return (
        <View style={[styles.center, { paddingHorizontal: space[6] }]} testID="map-empty-state">
          <Icon name="검색" color={colors.text.secondary} size={26} />
          <Title level="h3" color={colors.text.primary} style={{ marginTop: space[3] }}>
            검색 결과가 없어요
          </Title>
          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ marginTop: space[2], textAlign: 'center' }}
          >
            다른 이름이나 지역으로 다시 검색해보세요.
          </Caption>
        </View>
      );
    }
    return (
      <FlatList
        data={results}
        keyExtractor={(item) => item.providerPlaceId}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
        keyboardShouldPersistTaps="handled"
        testID="map-results-list"
      />
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <View style={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[3] }}>
        <Title level="h1" color={colors.text.primary}>
          지도
        </Title>
      </View>

      {/* 검색 입력 */}
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
        <View
          style={[
            styles.inputWrapper,
            {
              backgroundColor: colors.surface[2],
              borderColor: colors.border.strong,
              borderRadius: radius.md,
            },
          ]}
        >
          <View style={{ marginLeft: space[3], marginRight: space[2] }}>
            <Icon name="검색" color={colors.text.secondary} size={20} />
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="식당·카페·지역을 검색해요"
            placeholderTextColor={colors.text.disabled}
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, { color: colors.text.primary, paddingRight: space[3] }]}
            accessibilityLabel="장소 검색 입력창"
            testID="map-search-input"
          />
        </View>
      </View>

      {/* 네이티브 지도 준비 중 안내 (EAS Build 운영 트랙) */}
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
        <View
          style={[
            styles.notice,
            {
              backgroundColor: colors.semantic.info.bg,
              borderColor: colors.semantic.info.border,
              borderRadius: radius.md,
              padding: space[3],
            },
          ]}
          testID="map-pending-notice"
        >
          <Icon name="지도" color={colors.semantic.info.fg} size={18} />
          <Body
            variant="sm"
            color={colors.semantic.info.fg}
            style={{ marginLeft: space[2], flex: 1 }}
          >
            지도 화면은 준비 중이에요. 지금은 장소를 검색해 후보를 모을 수 있어요.
          </Body>
        </View>
      </View>

      {renderResults()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 44,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    fontFamily: 'PretendardVariable',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  cardIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
});
