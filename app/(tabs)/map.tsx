// 지도 탭 — 장소 검색 데이터 레이어 wire (S10) + W1-9 상태 디자인.
//
// 검색·필터·클러스터링 데이터는 useMapSearch(D26 debounce + 5분 격자 캐시 + Naver fallback)로
// 동작. 네이티브 지도 렌더(@mj-studio/react-native-naver-map)·제휴 마커 PNG·실기기 검증은
// EAS Build 운영 트랙(S13)이라 본 화면은 검색 결과를 리스트로 표시 + "지도 준비 중" 안내.
//
// W1-9: 결과 카드 = 탭 가능(상세 시트 → 카톡 공유). 이 탭은 그룹 컨텍스트가 없어 예약(Gate #2)
// 경로를 붙이지 않는다 — 읽기 전용 상세 + 공유만. 첫 로드만 Skeleton(이전 결과 유지) · 에러 시
// 이전 결과 보존 + 재시도 · 빈/초기 상태 §11.2.

import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { mapError } from '@/lib/i18n/messages';
import { createNativeShareApi, sharePlaceToKakao } from '@/lib/share/kakaoShare';
import { useMapSearch } from '@/lib/places/useMapSearch';
import type { PlaceSearchResult } from '@/lib/places/PlaceSearchProvider';

export default function MapScreen(): React.JSX.Element {
  const { colors, space, radius } = useTheme();
  const { query, setQuery, results, isLoading, error, retry } = useMapSearch();
  const toast = useToast();

  const [detailPlace, setDetailPlace] = useState<PlaceSearchResult | null>(null);
  const [sharing, setSharing] = useState(false);

  const hasQuery = query.trim().length > 0;
  const hasResults = results.length > 0;
  const firstLoading = isLoading && !hasResults && error === null;

  const handleShare = async (): Promise<void> => {
    if (detailPlace === null || sharing) return;
    setSharing(true);
    try {
      await sharePlaceToKakao(
        { groupName: '', placeName: detailPlace.name },
        { shareApi: createNativeShareApi() },
      );
      setDetailPlace(null);
    } catch (e) {
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    } finally {
      setSharing(false);
    }
  };

  const detailMessage = (p: PlaceSearchResult): string | undefined => {
    const parts = [p.category, p.address].filter(
      (v): v is string => typeof v === 'string' && v.length > 0,
    );
    return parts.length > 0 ? parts.join(' · ') : undefined;
  };

  const renderItem = ({ item }: { item: PlaceSearchResult }): React.JSX.Element => (
    <Pressable
      onPress={() => setDetailPlace(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} 상세 보기`}
      testID="map-result-card"
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface[1],
          borderColor: colors.border.subtle,
          borderRadius: radius.lg,
          padding: space[4],
          marginBottom: space[3],
          opacity: pressed ? 0.85 : 1,
        },
      ]}
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
        <Body variant="bold" color={colors.text.primary} numberOfLines={1}>
          {item.name}
        </Body>
        {item.category ? (
          <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: space[1] }}>
            {item.category}
          </Caption>
        ) : null}
        {item.address ? (
          <Body
            variant="sm"
            color={colors.text.secondary}
            style={{ marginTop: space[1] }}
            numberOfLines={1}
          >
            {item.address}
          </Body>
        ) : null}
      </View>
      <Icon name="화살표" color={colors.text.tertiary} size={20} />
    </Pressable>
  );

  const renderSkeleton = (): React.JSX.Element => (
    <View style={{ paddingHorizontal: space[4] }} testID="map-search-skeleton">
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
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
        >
          <Skeleton
            width={40}
            height={40}
            borderRadius={radius.full}
            style={{ marginRight: space[3] }}
          />
          <View style={styles.cardBody}>
            <Skeleton width="55%" height={16} />
            <Skeleton width="35%" height={13} style={{ marginTop: space[2] }} />
          </View>
        </View>
      ))}
    </View>
  );

  const renderResults = (): React.JSX.Element => {
    // 결과가 있으면 로딩/에러 중에도 유지 (점멸·결과 폐기 방지). 에러 시 상단 재시도 배너.
    if (hasResults) {
      return (
        <View style={styles.flex}>
          {error !== null ? (
            <View
              testID="map-error-banner"
              style={[
                styles.errorBanner,
                {
                  backgroundColor: colors.semantic.error.bg,
                  borderColor: colors.semantic.error.border,
                  borderRadius: radius.md,
                  marginHorizontal: space[4],
                  marginBottom: space[3],
                  padding: space[3],
                },
              ]}
            >
              <Body variant="sm" color={colors.semantic.error.fg} style={{ flex: 1 }}>
                결과를 새로 불러오지 못했어요.
              </Body>
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="다시 시도"
                testID="map-error-retry"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Body variant="sm-bold" color={colors.semantic.error.fg}>
                  다시 시도
                </Body>
              </Pressable>
            </View>
          ) : null}
          <FlatList
            data={results}
            keyExtractor={(item) => item.providerPlaceId}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[6] }}
            keyboardShouldPersistTaps="handled"
            testID="map-results-list"
          />
        </View>
      );
    }

    if (firstLoading) {
      return renderSkeleton();
    }

    if (error !== null) {
      return (
        <EmptyState
          variant="error"
          title="장소를 불러오지 못했어요"
          body={error}
          cta={{ label: '다시 시도', onPress: retry }}
          testID="map-error"
        />
      );
    }

    if (!hasQuery) {
      return (
        <EmptyState
          icon="검색"
          title="가고 싶은 곳을 검색해요"
          body="식당·카페 이름이나 지역을 입력하면 모임 장소 후보를 찾아드려요."
          testID="map-initial-state"
        />
      );
    }

    return (
      <EmptyState
        icon="검색"
        title="검색 결과가 없어요"
        body="다른 이름이나 지역으로 다시 검색해보세요."
        testID="map-empty-state"
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
            returnKeyType="search"
            style={[styles.input, { color: colors.text.primary }]}
            accessibilityLabel="장소 검색 입력창"
            testID="map-search-input"
          />
          {hasQuery ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="검색어 지우기"
              testID="map-search-clear"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => [styles.clearButton, { opacity: pressed ? 0.5 : 1 }]}
            >
              <Icon name="닫기" color={colors.text.tertiary} size={18} />
            </Pressable>
          ) : null}
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

      {/* 결과 카드 탭 → 읽기 전용 상세 + 카톡 공유 (그룹/예약 없음) */}
      <ConfirmSheet
        visible={detailPlace !== null}
        onClose={() => setDetailPlace(null)}
        title={detailPlace?.name ?? ''}
        message={detailPlace ? detailMessage(detailPlace) : undefined}
        confirmLabel="카톡으로 공유"
        cancelLabel="닫기"
        loading={sharing}
        onConfirm={handleShare}
        testID="map-detail"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
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
  clearButton: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
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
