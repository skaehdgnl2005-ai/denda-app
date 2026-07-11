import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DateTime } from 'luxon';

import HomeScreen from '../../app/(tabs)/index';
import { ThemeProvider } from '@/design/theme';

// 현 KST 기준 이번 달/지난 달 날짜(테스트 실행 시점 무관하게 결정적).
const nowKst = DateTime.now().setZone('Asia/Seoul');
const thisMonthIso = nowKst.set({ day: 15 }).toISODate() ?? '';
const lastMonthIso = nowKst.minus({ months: 1 }).set({ day: 15 }).toISODate() ?? '';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    // useFocusEffect는 마운트/포커스 시 콜백 실행 — 테스트에선 useEffect로 근사.
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: unknown) => unknown) => sel({ session: { user: { nickname: '민지' } } }),
}));

const mockFetchMyGroups = jest.fn();
jest.mock('@/lib/groups/list', () => ({
  fetchMyGroups: () => mockFetchMyGroups(),
}));

describe('HomeScreen', () => {
  const wrapper = ThemeProvider;
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyGroups.mockReset();
  });

  test('"새 모임 만들기" CTA → router.push(/group/new)', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { getByTestId } = render(<HomeScreen />, { wrapper });
    await act(async () => {});
    fireEvent.press(getByTestId('create-group-card'));
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  test('모임 있으면 카드 렌더 + 탭 시 그리드로 push', async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '5/30 저녁', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const card = await findByTestId('my-group-g1');
    fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith('/group/g1');
  });

  test('모임 없으면 빈 상태 노출', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { findByText } = render(<HomeScreen />, { wrapper });
    expect(await findByText('잡힌 모임이 아직 없어요')).toBeTruthy();
  });

  // S15-mapmode-ui-calendar: "지도로 보기" 진입 버튼 → /schedule/map navigation.
  test('"지도로 보기" 버튼 → router.push(/schedule/map)', async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '5/30 저녁', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const btn = await findByTestId('schedule-map-entry');
    fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith('/schedule/map');
  });

  // W3-3: "지도로 보기" 진입은 캡션 1줄(~18pt)이라 hitSlop 없이는 44pt 미달 → hitSlop 보정.
  test('W3-3 — "지도로 보기" hitSlop이 44pt 터치 타깃 확보 (DESIGN §12.1)', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const btn = await findByTestId('schedule-map-entry');
    const hs = btn.props.hitSlop;
    expect(hs).toBeDefined();
    expect(18 + hs.top + hs.bottom).toBeGreaterThanOrEqual(44);
  });

  // R2: 알림 벨 제거 — 죽은 'notifications-button'이 더 이상 없어야 한다.
  test('알림 벨 제거 (notifications-button 부재)', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { queryByTestId } = render(<HomeScreen />, { wrapper });
    await act(async () => {});
    expect(queryByTestId('notifications-button')).toBeNull();
  });

  // W1-7: fetch 실패를 빈 상태로 위장하지 않고 EmptyState error + 재시도.
  test('fetch 실패 → EmptyState error (빈 상태 위장 아님) + 다시 시도 refetch', async () => {
    mockFetchMyGroups.mockRejectedValueOnce(new Error('network'));
    const { findByTestId, getByTestId, queryByText, findByText } = render(<HomeScreen />, {
      wrapper,
    });
    await findByTestId('home-error');
    expect(queryByText('잡힌 모임이 아직 없어요')).toBeNull();

    mockFetchMyGroups.mockResolvedValueOnce([
      { id: 'g9', name: '재시도 모임', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    await act(async () => {
      fireEvent.press(getByTestId('home-error-cta'));
    });
    expect(await findByText('재시도 모임')).toBeTruthy();
  });

  // W2-9: '이번 달 모임' 스탯 = 이번 달 후보 날짜가 있는 모임 수(파생값).
  test("'이번 달 모임' 스탯이 파생 카운트를 표시", async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '이번 달', dates: [thisMonthIso], confirmedAt: null },
      { id: 'g2', name: '지난 달', dates: [lastMonthIso], confirmedAt: null },
    ]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const value = await findByTestId('stat-this-month-value');
    expect(value.props.children).toBe('1');
  });

  // W2-9 §17.2: 데이터 없는 '함께한 친구'·'노쇼' 가짜 0 칩 제거.
  test("'함께한 친구'·'노쇼' 칩 제거(가짜 0 금지)", async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { queryByText, findByText } = render(<HomeScreen />, { wrapper });
    await findByText('잡힌 모임이 아직 없어요');
    expect(queryByText('함께한 친구')).toBeNull();
    expect(queryByText('노쇼')).toBeNull();
    expect(queryByText('이번 달 모임')).toBeTruthy();
  });

  // W2-9 §17.3: 카드 위계 — 우측 chevron + 상태 라벨(색 단독 아님).
  test('내 모임 카드에 chevron + 상태 라벨 존재', async () => {
    mockFetchMyGroups.mockResolvedValue([
      { id: 'g1', name: '5/30 저녁', dates: ['2026-05-30'], confirmedAt: null },
    ]);
    const { findByTestId, findByText } = render(<HomeScreen />, { wrapper });
    expect(await findByTestId('my-group-g1-chevron')).toBeTruthy();
    expect(await findByText('투표 중')).toBeTruthy();
  });

  // W2-9 §11.2: 빈 상태 CTA(secondary) → /group/new.
  test('빈 상태 CTA → router.push(/group/new)', async () => {
    mockFetchMyGroups.mockResolvedValue([]);
    const { findByTestId } = render(<HomeScreen />, { wrapper });
    const cta = await findByTestId('home-empty-cta');
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });
});
