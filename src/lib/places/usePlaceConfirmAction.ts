// S-MAP M2 — 장소 확정 단일 액션 (Gate #2 click 정확도).
//
// 검색결과 리스트 탭과 (점등 시) 지도 마커 onPress를 같은 확정 액션으로 수렴시킨다.
//   - 리스트 카드 tap → 화면이 Alert 확인 → confirm(result)
//   - 마커 onPress(actionId) → findResultByActionId(results, actionId) → 화면이 Alert 확인 → confirm(result)
//
// 더블탭 idempotency: useState 가드는 setState가 비동기라 같은 tick 더블탭 시 stale closure로
// 둘 다 통과해 2회 로그될 수 있다(Gate #2 정확도 훼손). 여기서는 useRef 동기 lock으로 두 번째
// 호출을 즉시 차단해 persist·setConfirmedPlace·navigate를 정확히 1회만 수행한다.

import { useCallback, useRef, useState } from 'react';

import { setConfirmedPlace } from '@/lib/groups/setConfirmedPlace';
import { persistPlace } from '@/lib/places/persist';

import type { PlaceSearchResult } from './PlaceSearchProvider';

const GENERIC_FAIL_MESSAGE = '장소를 확정하지 못했어요. 잠시 후 다시 시도해주세요.';

export interface PlaceConfirmHandlers {
  /** persist + setConfirmedPlace 성공 시 — 화면이 place 라우트로 이동. */
  onConfirmed?: (placeId: string) => void;
  /** 실패 시 한국어 메시지 — 화면이 Alert/토스트로 노출. */
  onError?: (message: string) => void;
}

export interface PlaceConfirmAction {
  /** 장소 확정 (persist → setConfirmedPlace → onConfirmed). 동기 더블탭 idempotent. */
  confirm: (result: PlaceSearchResult) => Promise<void>;
  /** UI 비활성/스피너용 상태 (실 가드는 내부 ref). */
  inflight: boolean;
}

/**
 * 마커 actionId(=providerPlaceId)로 검색결과를 resolve.
 * 리스트 탭과 마커 onPress가 같은 확정 액션을 호출하도록 잇는 단일 진입점.
 */
export function findResultByActionId(
  results: PlaceSearchResult[],
  actionId: string,
): PlaceSearchResult | null {
  return results.find((r) => r.providerPlaceId === actionId) ?? null;
}

export function usePlaceConfirmAction(
  groupId: string,
  handlers: PlaceConfirmHandlers = {},
): PlaceConfirmAction {
  const lockRef = useRef(false);
  const [inflight, setInflight] = useState(false);
  const { onConfirmed, onError } = handlers;

  const confirm = useCallback(
    async (result: PlaceSearchResult): Promise<void> => {
      // 동기 lock — 같은 tick 두 번째 호출은 ref가 이미 true라 즉시 차단 (1 event만).
      if (lockRef.current) return;
      lockRef.current = true;
      setInflight(true);
      try {
        const placeId = await persistPlace(result);
        await setConfirmedPlace(groupId, placeId);
        onConfirmed?.(placeId);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : GENERIC_FAIL_MESSAGE);
      } finally {
        lockRef.current = false;
        setInflight(false);
      }
    },
    [groupId, onConfirmed, onError],
  );

  return { confirm, inflight };
}
