import { renderHook, act } from '@testing-library/react-native';

import { usePlaceConfirmAction, findResultByActionId } from './usePlaceConfirmAction';
import type { PlaceSearchResult } from './PlaceSearchProvider';

const mockPersistPlace = jest.fn();
jest.mock('@/lib/places/persist', () => ({
  persistPlace: (...args: unknown[]) => mockPersistPlace(...args),
}));

const mockSetConfirmedPlace = jest.fn();
jest.mock('@/lib/groups/setConfirmedPlace', () => ({
  setConfirmedPlace: (...args: unknown[]) => mockSetConfirmedPlace(...args),
}));

const sample: PlaceSearchResult = {
  providerPlaceId: 'naver:한솥도시락 안암점:37.123:127.456',
  name: '한솥도시락 안암점',
  category: '한식',
  address: '서울 성북구 안암동',
  lat: 37.123,
  lng: 127.456,
  phone: null,
  source: 'naver',
};
const other: PlaceSearchResult = {
  ...sample,
  providerPlaceId: 'naver:김밥천국:37.2:127.5',
  name: '김밥천국',
};

describe('findResultByActionId (마커 actionId → 검색결과 resolve)', () => {
  test('actionId(providerPlaceId) 일치 결과 반환', () => {
    expect(findResultByActionId([sample, other], other.providerPlaceId)).toBe(other);
  });

  test('미일치 → null', () => {
    expect(findResultByActionId([sample], 'naver:없음:0:0')).toBeNull();
  });

  test('빈 결과 → null', () => {
    expect(findResultByActionId([], sample.providerPlaceId)).toBeNull();
  });
});

describe('usePlaceConfirmAction (단일 확정 액션 + 더블탭 idempotency)', () => {
  beforeEach(() => {
    mockPersistPlace.mockReset();
    mockSetConfirmedPlace.mockReset();
  });

  test('confirm → persistPlace → setConfirmedPlace(groupId, placeId) → onConfirmed(placeId)', async () => {
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);
    const onConfirmed = jest.fn();
    const { result } = renderHook(() => usePlaceConfirmAction('g-1', { onConfirmed }));

    await act(async () => {
      await result.current.confirm(sample);
    });

    expect(mockPersistPlace).toHaveBeenCalledWith(sample);
    expect(mockSetConfirmedPlace).toHaveBeenCalledWith('g-1', 'place-uuid');
    expect(onConfirmed).toHaveBeenCalledWith('place-uuid');
  });

  test('동기 더블 호출 → persist·setConfirmedPlace·onConfirmed 각 1회 (ref 동기 가드, Gate #2 정확도)', async () => {
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);
    const onConfirmed = jest.fn();
    const { result } = renderHook(() => usePlaceConfirmAction('g-1', { onConfirmed }));

    await act(async () => {
      // 같은 tick에 두 번 — useState 가드는 비동기라 둘 다 통과(2회 로그)하지만
      // ref 동기 가드는 두 번째를 즉시 차단해야 한다 (1 event만).
      await Promise.all([result.current.confirm(sample), result.current.confirm(sample)]);
    });

    expect(mockPersistPlace).toHaveBeenCalledTimes(1);
    expect(mockSetConfirmedPlace).toHaveBeenCalledTimes(1);
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  test('persistPlace 실패 → onError(한국어) + setConfirmedPlace·onConfirmed 미호출', async () => {
    mockPersistPlace.mockRejectedValue(
      new Error('장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.'),
    );
    const onConfirmed = jest.fn();
    const onError = jest.fn();
    const { result } = renderHook(() => usePlaceConfirmAction('g-1', { onConfirmed, onError }));

    await act(async () => {
      await result.current.confirm(sample);
    });

    expect(onError).toHaveBeenCalledWith('장소를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
    expect(mockSetConfirmedPlace).not.toHaveBeenCalled();
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  test('confirm 완료 후 inflight=false 복귀 (lock 해제 → 재시도 가능)', async () => {
    mockPersistPlace.mockResolvedValue('place-uuid');
    mockSetConfirmedPlace.mockResolvedValue(undefined);
    const { result } = renderHook(() => usePlaceConfirmAction('g-1', {}));

    await act(async () => {
      await result.current.confirm(sample);
    });

    expect(result.current.inflight).toBe(false);
  });
});
