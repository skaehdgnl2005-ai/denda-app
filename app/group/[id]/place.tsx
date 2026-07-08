// S08-ui — 장소 액션 화면 (마커 탭 후 진입).
//
// Route: /group/[id]/place?placeId=<uuid>
//   - id (path) = groupId
//   - placeId (query) = places.id
//
// 책임:
//   - group(name) + place(name, category, address, partnership_id) fetch
//   - PlaceActionSheet 노출 — onClose → router.back()
//   - onReservationPress → logReservationClick({groupId, placeId, partnershipId})
//     → 성공 시 Alert "식당에 알릴 준비가 됐어요" (Q-B12 micro-copy founder review 대기)
//   - onSharePress → sharePlaceToKakao({groupName, placeName, url?}) RN Share API
//
// S10 wire-up: 마커 onPress → router.push(`/group/${groupId}/place?placeId=${placeId}`)
// S10 BLOCKED 동안에도 본 화면 standalone 진입 가능 (dev/QA).

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { PlaceActionSheet } from '@/components/place/PlaceActionSheet';
import { Spinner } from '@/components/Spinner';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { logReservationClick } from '@/lib/analytics/click_through';
import { fetchGroupForConfirm, type GroupForConfirm } from '@/lib/groups/queries';
import { messages } from '@/lib/i18n/messages';
import { fetchPlace, type Place } from '@/lib/places/queries';
import { createNativeShareApi, sharePlaceToKakao } from '@/lib/share/kakaoShare';

export default function GroupPlaceScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string; placeId?: string }>();
  const groupId = params.id ?? '';
  const placeId = params.placeId ?? '';
  const router = useRouter();
  const { colors, space } = useTheme();
  const toast = useToast();

  const [group, setGroup] = useState<GroupForConfirm | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!groupId || !placeId) return;
    let cancelled = false;
    Promise.all([fetchGroupForConfirm(groupId), fetchPlace(placeId)])
      .then(([g, p]) => {
        if (cancelled) return;
        setGroup(g);
        setPlace(p);
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message);
      });
    return (): void => {
      cancelled = true;
    };
  }, [groupId, placeId]);

  const handleClose = useCallback((): void => {
    router.back();
  }, [router]);

  const handleReservation = useCallback(async (): Promise<void> => {
    if (!group || !place) return;
    // Gate #2 측정 — logReservationClick은 1회성 idempotent (변경 금지).
    await logReservationClick({
      groupId: group.id,
      placeId: place.id,
      partnershipId: place.partnershipId,
    });
    // Gate #2 클라이맥스 — 시스템 Alert 대신 success 토스트 (§11.3, Q-B12 카피).
    toast.show({ message: messages.success.reservationReady, variant: 'success' });
  }, [group, place, toast]);

  const handleShare = useCallback(async (): Promise<void> => {
    if (!group || !place) return;
    const shareApi = createNativeShareApi();
    await sharePlaceToKakao({ groupName: group.name, placeName: place.name }, { shareApi });
  }, [group, place]);

  if (!groupId || !placeId) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
        <View style={[styles.centered, { padding: space[4] }]}>
          <EmptyState
            icon="장소"
            title="장소 정보가 없어요"
            body="이전 화면에서 장소를 다시 선택해주세요"
            cta={{ label: '돌아가기', onPress: () => router.back() }}
            testID="place-none"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
        <View style={[styles.centered, { padding: space[4] }]}>
          <EmptyState
            variant="error"
            title="장소를 불러오지 못했어요"
            body="잠시 후 다시 시도해볼게요"
            cta={{ label: '돌아가기', onPress: () => router.back() }}
            testID="place-error"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!group || !place) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
        <View style={[styles.centered, { padding: space[4] }]} testID="place-loading">
          <Spinner />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <PlaceActionSheet
        visible={true}
        onClose={handleClose}
        place={{
          id: place.id,
          name: place.name,
          category: place.category ?? undefined,
          address: place.address ?? undefined,
        }}
        groupName={group.name}
        isPartnership={place.partnershipId !== null}
        onReservationPress={handleReservation}
        onSharePress={handleShare}
        testID="place-action-sheet"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
