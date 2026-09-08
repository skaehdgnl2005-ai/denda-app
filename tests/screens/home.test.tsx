// S25 — 홈 = 나만의 캘린더 (PRD §5.1 복귀).
// 월간 캘린더 + 선택일 목록 + 다가오는 모임. 인사말·보라 CTA 카드·이번 달 스탯은 제거됨.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DateTime } from 'luxon';

import HomeScreen from '../../app/(tabs)/index';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';

const KST = 'Asia/Seoul';
const today = DateTime.now().setZone(KST);
const todayIso = today.toISODate() ?? '';
// 이번 달 안의 결정적 앵커 — 오늘이 말일이어도 같은 달에 머무는 값
const inMonthIso = today.set({ day: today.day >= 15 ? 5 : 20 }).toISODate() ?? '';
const nextMonthIso = today.plus({ months: 1 }).set({ day: 10 }).toISODate() ?? '';

function kstUtcIso(dateIso: string, hour: number, minute = 0): string {
  return (
    DateTime.fromISO(dateIso, { zone: KST }).set({ hour, minute }).toUTC().toISO({
      suppressMilliseconds: false,
    }) ?? ''
  );
}

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
    useFocusEffect: (cb: () => void) => ReactMod.useEffect(() => cb(), [cb]),
  };
});

jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: unknown) => unknown) =>
    sel({ session: { user: { id: 'u1', nickname: '민지' } } }),
}));

const mockFetchMyGroups = jest.fn();
jest.mock('@/lib/groups/list', () => ({
  fetchMyGroups: () => mockFetchMyGroups(),
}));

const mockFetchSchedules = jest.fn();
jest.mock('@/lib/schedules/queries', () => ({
  fetchActiveSchedules: (userId: string) => mockFetchSchedules(userId),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 47, left: 0, right: 0, bottom: 34 },
    }}
  >
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

function group(over: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    name: '동아리 회식',
    dates: [inMonthIso],
    confirmedAt: null,
    confirmedStartAt: null,
    confirmedEndAt: null,
    placeName: null,
    ...over,
  };
}

async function renderHome() {
  const utils = render(<HomeScreen />, { wrapper });
  await act(async () => {});
  return utils;
}

describe('HomeScreen — 캘린더', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyGroups.mockReset().mockResolvedValue([]);
    mockFetchSchedules.mockReset().mockResolvedValue([]);
  });

  test('진입 시 이번 달 캘린더와 오늘 일정이 주인공', async () => {
    const { getByTestId } = await renderHome();
    expect(getByTestId('home-calendar')).toBeTruthy();
    expect(getByTestId('month-calendar-title').props.children).toBe(
      `${today.year}년 ${today.month}월`,
    );
    expect(getByTestId('day-agenda-header')).toBeTruthy();
  });

  test('제거된 요소 — 보라 CTA 카드·인사말·이번 달 스탯', async () => {
    const { queryByTestId, queryByText } = await renderHome();
    expect(queryByTestId('create-group-card')).toBeNull();
    expect(queryByTestId('stat-this-month-value')).toBeNull();
    expect(queryByText('오늘 어떤 모임 잡아볼까요?')).toBeNull();
  });

  test('확정 모임이 캘린더 마커 + 선택일 목록에 나타난다', async () => {
    mockFetchMyGroups.mockResolvedValue([
      group({
        confirmedAt: kstUtcIso(inMonthIso, 12),
        confirmedStartAt: kstUtcIso(inMonthIso, 19),
        confirmedEndAt: kstUtcIso(inMonthIso, 22),
        placeName: '강남 이자카야',
      }),
    ]);
    const { getByTestId, findByText } = await renderHome();
    expect(getByTestId(`month-marker-${inMonthIso}`)).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId(`month-day-${inMonthIso}`));
    });
    expect(await findByText('동아리 회식')).toBeTruthy();
    expect(await findByText('강남 이자카야')).toBeTruthy();
  });

  test('모임 항목 탭 → 모임 상세로 이동', async () => {
    mockFetchMyGroups.mockResolvedValue([group()]);
    const { getByTestId } = await renderHome();
    await act(async () => {
      fireEvent.press(getByTestId(`month-day-${inMonthIso}`));
    });
    await act(async () => {
      fireEvent.press(getByTestId(`agenda-item-group:g1:${inMonthIso}`));
    });
    expect(mockPush).toHaveBeenCalledWith('/group/g1');
  });

  test('에브리타임 수업은 선택일 목록에만 (월 마커 없음)', async () => {
    mockFetchSchedules.mockResolvedValue([
      {
        id: 's1',
        user_id: 'u1',
        source: 'everytime',
        title: '선형대수',
        start_at: kstUtcIso(inMonthIso, 10),
        end_at: kstUtcIso(inMonthIso, 11, 30),
        recurrence_rule: null,
        expires_at: null,
        external_id: null,
      },
    ]);
    const { getByTestId, queryByTestId, findByText } = await renderHome();
    expect(queryByTestId(`month-marker-${inMonthIso}`)).toBeNull();
    await act(async () => {
      fireEvent.press(getByTestId(`month-day-${inMonthIso}`));
    });
    expect(await findByText('선형대수')).toBeTruthy();
    expect(await findByText('수업')).toBeTruthy();
  });

  test('달을 넘겨도 선택일 일정이 유지된다 (전개 창이 선택일을 덮는다)', async () => {
    mockFetchMyGroups.mockResolvedValue([group({ dates: [nextMonthIso] })]);
    const { getByTestId, findByTestId } = await renderHome();
    await act(async () => {
      fireEvent.press(getByTestId('month-calendar-next'));
    });
    await act(async () => {
      fireEvent.press(getByTestId(`month-day-${nextMonthIso}`));
    });
    // 이름은 '다가오는 모임' 카드에도 나오므로 목록 항목 자체를 확인
    expect(await findByTestId(`agenda-item-group:g1:${nextMonthIso}`)).toBeTruthy();
  });

  test('"지도로 보기" → /schedule/map (testID·hitSlop 유지)', async () => {
    const { getByTestId } = await renderHome();
    const btn = getByTestId('schedule-map-entry');
    const hs = btn.props.hitSlop;
    expect(18 + hs.top + hs.bottom).toBeGreaterThanOrEqual(44);
    fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith('/schedule/map');
  });
});

describe('HomeScreen — 개인 일정', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyGroups.mockReset().mockResolvedValue([]);
    mockFetchSchedules.mockReset().mockResolvedValue([]);
  });

  test('"일정 추가" → 선택일이 채워진 시트', async () => {
    const { getByTestId } = await renderHome();
    await act(async () => {
      fireEvent.press(getByTestId('day-agenda-add'));
    });
    expect(getByTestId('personal-sheet-title').props.children).toBe('일정 추가');
  });

  test('내 일정 탭 → 수정 모드 시트', async () => {
    mockFetchSchedules.mockResolvedValue([
      {
        id: 's2',
        user_id: 'u1',
        source: 'manual',
        title: '치과',
        start_at: kstUtcIso(todayIso, 15),
        end_at: kstUtcIso(todayIso, 16),
        recurrence_rule: null,
        expires_at: null,
        external_id: null,
      },
    ]);
    const { getByTestId } = await renderHome();
    await act(async () => {
      fireEvent.press(getByTestId(`agenda-item-schedule:s2:${todayIso}`));
    });
    expect(getByTestId('personal-sheet-title').props.children).toBe('일정 수정');
    expect(getByTestId('personal-sheet-input').props.value).toBe('치과');
  });

  test('시간표 미등록이면 불러오기 힌트 → /schedule/everytime', async () => {
    const { getByTestId } = await renderHome();
    fireEvent.press(getByTestId('home-everytime-hint'));
    expect(mockPush).toHaveBeenCalledWith('/schedule/everytime');
  });

  test('시간표를 이미 등록했으면 힌트는 숨긴다', async () => {
    mockFetchSchedules.mockResolvedValue([
      {
        id: 's1',
        user_id: 'u1',
        source: 'everytime',
        title: '선형대수',
        start_at: kstUtcIso(inMonthIso, 10),
        end_at: kstUtcIso(inMonthIso, 11, 30),
        recurrence_rule: null,
        expires_at: null,
        external_id: null,
      },
    ]);
    const { queryByTestId } = await renderHome();
    expect(queryByTestId('home-everytime-hint')).toBeNull();
  });
});

describe('HomeScreen — 다가오는 모임 / 상태', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchMyGroups.mockReset().mockResolvedValue([]);
    mockFetchSchedules.mockReset().mockResolvedValue([]);
  });

  test('다가오는 모임 카드 탭 → 모임 상세', async () => {
    mockFetchMyGroups.mockResolvedValue([
      group({ dates: [today.plus({ days: 2 }).toISODate() ?? ''] }),
    ]);
    const { findByTestId } = await renderHome();
    fireEvent.press(await findByTestId('my-group-g1'));
    expect(mockPush).toHaveBeenCalledWith('/group/g1');
  });

  test('모임이 없으면 빈 카드 + 모임 만들기 CTA', async () => {
    const { findByText, getByTestId } = await renderHome();
    expect(await findByText('잡힌 모임이 아직 없어요')).toBeTruthy();
    fireEvent.press(getByTestId('home-empty-cta'));
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });

  // W1-7: fetch 실패를 빈 상태로 위장하지 않는다.
  test('fetch 실패 → EmptyState error + 재시도로 복구', async () => {
    mockFetchMyGroups.mockRejectedValueOnce(new Error('network'));
    const { findByTestId, getByTestId, queryByText, findByText } = await renderHome();
    await findByTestId('home-error');
    expect(queryByText('잡힌 모임이 아직 없어요')).toBeNull();

    mockFetchMyGroups.mockResolvedValueOnce([
      group({ id: 'g9', name: '재시도 모임', dates: [today.plus({ days: 2 }).toISODate() ?? ''] }),
    ]);
    await act(async () => {
      fireEvent.press(getByTestId('home-error-cta'));
    });
    expect(await findByText('재시도 모임')).toBeTruthy();
  });

  test('첫 로드에는 스켈레톤', async () => {
    let resolveGroups: (v: unknown) => void = () => {};
    mockFetchMyGroups.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveGroups = res;
        }),
    );
    const { getByTestId } = render(<HomeScreen />, { wrapper });
    expect(getByTestId('home-loading')).toBeTruthy();
    await act(async () => {
      resolveGroups([]);
    });
  });
});
