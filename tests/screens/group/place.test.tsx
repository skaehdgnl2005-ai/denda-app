import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GroupPlaceScreen from '../../../app/group/[id]/place';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { messages } from '@/lib/i18n/messages';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';
const VALID_PLACE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_PARTNERSHIP_ID = '99999999-8888-7777-6666-555555555555';

let mockParams: { id?: string; placeId?: string } = {
  id: VALID_GROUP_ID,
  placeId: VALID_PLACE_ID,
};
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }),
}));

const mockFetchGroup = jest.fn();
const mockFetchPlace = jest.fn();
const mockLogReservationClick = jest.fn();
const mockSharePlaceToKakao = jest.fn();
const mockCreateNativeShareApi = jest.fn(() => ({ share: jest.fn() }));

jest.mock('@/lib/groups/queries', () => ({
  fetchGroupForConfirm: (...args: unknown[]) => mockFetchGroup(...args),
  fetchUserVotes: jest.fn(),
}));
jest.mock('@/lib/places/queries', () => ({
  fetchPlace: (...args: unknown[]) => mockFetchPlace(...args),
}));
jest.mock('@/lib/analytics/click_through', () => ({
  logReservationClick: (...args: unknown[]) => mockLogReservationClick(...args),
}));
jest.mock('@/lib/share/kakaoShare', () => ({
  sharePlaceToKakao: (...args: unknown[]) => mockSharePlaceToKakao(...args),
  createNativeShareApi: () => mockCreateNativeShareApi(),
}));

describe('GroupPlaceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: VALID_GROUP_ID, placeId: VALID_PLACE_ID };
    mockFetchGroup.mockReset();
    mockFetchPlace.mockReset();
    mockLogReservationClick.mockReset();
    mockSharePlaceToKakao.mockReset();
    mockCreateNativeShareApi.mockClear();
    mockCreateNativeShareApi.mockReturnValue({ share: jest.fn() });
  });

  function mockHappyFetch(): void {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: 'host-id',
      name: '5/30 저녁',
      dates: ['2026-05-30'],
      memberCount: 3,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    mockFetchPlace.mockResolvedValue({
      id: VALID_PLACE_ID,
      name: '한솥도시락 안암점',
      category: '한식',
      address: '서울 성북구 안암동',
      partnershipId: VALID_PARTNERSHIP_ID,
    });
  }

  test('초기 loading → Spinner → fetch 후 sheet 노출', async () => {
    mockHappyFetch();
    const { getByTestId, findByText } = render(<GroupPlaceScreen />, { wrapper });
    expect(getByTestId('place-loading')).toBeTruthy();
    expect(await findByText('한솥도시락 안암점')).toBeTruthy();
  });

  test('placeId param 누락 → EmptyState "장소 정보가 없어요"', () => {
    mockParams = { id: VALID_GROUP_ID };
    const { getByText } = render(<GroupPlaceScreen />, { wrapper });
    expect(getByText('장소 정보가 없어요')).toBeTruthy();
  });

  test('fetch error → raw 메시지 대신 EmptyState error variant (위장 해제 §11.3)', async () => {
    mockFetchGroup.mockRejectedValue(new Error('모임을 찾을 수 없어요.'));
    mockFetchPlace.mockResolvedValue({});
    const { findByTestId, queryByText } = render(<GroupPlaceScreen />, { wrapper });
    expect(await findByTestId('place-error')).toBeTruthy();
    // raw 기술 메시지는 사용자에게 노출하지 않는다
    expect(queryByText('모임을 찾을 수 없어요.')).toBeNull();
  });

  test('"예약하기" press → logReservationClick({groupId, placeId, partnershipId}) 호출', async () => {
    mockHappyFetch();
    mockLogReservationClick.mockResolvedValue({
      ok: true,
      eventId: 'evt',
      duplicated: false,
    });

    const { findByTestId, findByText } = render(<GroupPlaceScreen />, { wrapper });
    const cta = await findByTestId('reservation-cta');
    await act(async () => {
      fireEvent.press(cta);
    });

    await waitFor(() =>
      expect(mockLogReservationClick).toHaveBeenCalledWith({
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
        partnershipId: VALID_PARTNERSHIP_ID,
      }),
    );
    // Alert 대신 success 토스트 (Gate #2 클라이맥스)
    expect(await findByText(messages.success.reservationReady)).toBeTruthy();
  });

  test('"장소만 정하기" press → sharePlaceToKakao + native share api 호출', async () => {
    mockHappyFetch();
    mockSharePlaceToKakao.mockResolvedValue({ shared: true });

    const { findByTestId } = render(<GroupPlaceScreen />, { wrapper });
    const cta = await findByTestId('share-cta');
    await act(async () => {
      fireEvent.press(cta);
    });

    await waitFor(() => {
      expect(mockCreateNativeShareApi).toHaveBeenCalledTimes(1);
      const [args, options] = mockSharePlaceToKakao.mock.calls[0] ?? [];
      expect(args).toEqual({
        groupName: '5/30 저녁',
        placeName: '한솥도시락 안암점',
      });
      expect(options).toHaveProperty('shareApi');
    });
  });

  test('"예약하기" 성공 → onClose 후 router.back 호출', async () => {
    mockHappyFetch();
    mockLogReservationClick.mockResolvedValue({
      ok: true,
      eventId: 'evt',
      duplicated: false,
    });

    const { findByTestId } = render(<GroupPlaceScreen />, { wrapper });
    const cta = await findByTestId('reservation-cta');
    await act(async () => {
      fireEvent.press(cta);
    });

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  test('partnershipId null인 비제휴 장소도 정상 동작', async () => {
    mockFetchGroup.mockResolvedValue({
      id: VALID_GROUP_ID,
      hostId: 'h',
      name: 'g',
      dates: ['2026-05-30'],
      memberCount: 1,
      confirmedAt: null,
      confirmedStartAt: null,
      confirmedEndAt: null,
      confirmedPlaceId: null,
    });
    mockFetchPlace.mockResolvedValue({
      id: VALID_PLACE_ID,
      name: '식당',
      category: null,
      address: null,
      partnershipId: null,
    });
    mockLogReservationClick.mockResolvedValue({
      ok: true,
      eventId: 'evt',
      duplicated: false,
    });

    const { findByTestId } = render(<GroupPlaceScreen />, { wrapper });
    const cta = await findByTestId('reservation-cta');
    await act(async () => {
      fireEvent.press(cta);
    });

    await waitFor(() =>
      expect(mockLogReservationClick).toHaveBeenCalledWith({
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
        partnershipId: null,
      }),
    );
  });
});
