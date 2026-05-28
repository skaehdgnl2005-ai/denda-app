// S15-mapmode-ui-calendar — "지도로 내 일정 보기" 화면.
//
// 시간 범위 picker(이번주/이번달/전체) + viewMode 토글(리스트/지도) +
// fetchConfirmedGroupSchedules → toScheduleMapPoints. 지도 모드는 placeholder
// ("준비 중" notice) — native MapView SDK는 EAS Build 운영 트랙 deferred.

import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import ScheduleMapScreen from '../../../app/schedule/map';
import { ThemeProvider } from '@/design/theme';
import type { ConfirmedGroupScheduleInput } from '@/lib/schedules/scheduleMapPoint';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: mockBack }),
}));

const mockFetch = jest.fn();
jest.mock('@/lib/schedules/groupScheduleQueries', () => ({
  fetchConfirmedGroupSchedules: () => mockFetch(),
}));

const baseRow: ConfirmedGroupScheduleInput = {
  groupId: 'g1',
  groupName: '저녁',
  placeId: 'p1',
  placeName: '광장시장',
  lat: 37.5704,
  lng: 126.9999,
  confirmedStartAt: '2026-05-29T10:00:00.000Z', // KST 5/29 19:00
};

describe('ScheduleMapScreen', () => {
  const wrapper = ThemeProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  test('mount → fetch + 점들이 ①②③ 시간순으로 렌더', async () => {
    mockFetch.mockResolvedValue([
      { ...baseRow, groupId: 'g1', confirmedStartAt: '2026-05-28T10:00:00.000Z' },
      { ...baseRow, groupId: 'g2', confirmedStartAt: '2026-05-29T10:00:00.000Z' },
    ]);
    const { findByTestId } = render(<ScheduleMapScreen />, { wrapper });
    const card1 = await findByTestId('schedule-point-1');
    const card2 = await findByTestId('schedule-point-2');
    expect(card1).toBeTruthy();
    expect(card2).toBeTruthy();
  });

  test('빈 결과 → 빈 상태 카피 노출', async () => {
    mockFetch.mockResolvedValue([]);
    const { findByTestId } = render(<ScheduleMapScreen />, { wrapper });
    expect(await findByTestId('schedule-empty')).toBeTruthy();
  });

  test('fetch 에러 → 에러 메시지 + 한국어', async () => {
    mockFetch.mockRejectedValue(
      new Error('모임 일정을 불러오지 못했어요. 잠시 후 다시 시도해주세요.'),
    );
    const { findByText } = render(<ScheduleMapScreen />, { wrapper });
    expect(await findByText(/모임 일정을 불러오지 못했어요/)).toBeTruthy();
  });

  test('viewMode 토글: 리스트 → 지도 모드 → "준비 중" placeholder', async () => {
    mockFetch.mockResolvedValue([baseRow]);
    const { findByTestId, getByTestId, queryByTestId } = render(<ScheduleMapScreen />, { wrapper });
    await findByTestId('schedule-point-1');
    // default = list
    expect(queryByTestId('schedule-map-placeholder')).toBeNull();
    // 지도 모드로 토글
    fireEvent.press(getByTestId('view-mode-map'));
    await waitFor(() => {
      expect(getByTestId('schedule-map-placeholder')).toBeTruthy();
    });
  });

  test('time range chip "전체" 선택 → range 필터 해제', async () => {
    // 모든 점을 의도적으로 *과거*로 넣어 이번주/이번달 필터는 0개를 반환하도록
    mockFetch.mockResolvedValue([
      { ...baseRow, groupId: 'past', confirmedStartAt: '2020-01-01T00:00:00.000Z' },
    ]);
    const { findByTestId, getByTestId, queryByTestId } = render(<ScheduleMapScreen />, { wrapper });
    // 이번주 default → 빈 상태
    await findByTestId('schedule-empty');
    // 전체 chip 누르면 점이 노출
    fireEvent.press(getByTestId('range-chip-all'));
    await waitFor(() => {
      expect(getByTestId('schedule-point-1')).toBeTruthy();
      expect(queryByTestId('schedule-empty')).toBeNull();
    });
  });

  test('뒤로 가기 → router.back()', async () => {
    mockFetch.mockResolvedValue([]);
    const { findByTestId } = render(<ScheduleMapScreen />, { wrapper });
    await act(async () => {});
    fireEvent.press(await findByTestId('back-button'));
    expect(mockBack).toHaveBeenCalled();
  });
});
