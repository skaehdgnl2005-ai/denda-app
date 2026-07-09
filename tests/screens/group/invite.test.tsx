// S22 — 호스트 인앱 모임 초대 화면 (multi-select → batch createInvitation)
import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GroupInviteScreen from '../../../app/group/[id]/invite';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import type { FriendUser } from '@/lib/friends/api';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'g-1' }),
}));

const mockListFriends = jest.fn();
const mockCreateInvitation = jest.fn();
jest.mock('@/lib/friends/api', () => ({
  friendsApi: {
    list: (...args: unknown[]) => mockListFriends(...args),
  },
}));
jest.mock('@/lib/groups/invitations', () => ({
  invitationsApi: {
    createInvitation: (...args: unknown[]) => mockCreateInvitation(...args),
  },
}));

const friendA: FriendUser = { id: 'u-a', nickname: '홍길동' };
const friendB: FriendUser = { id: 'u-b', nickname: '김영희' };
const friendC: FriendUser = { id: 'u-c', nickname: '이몽룡' };

const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

describe('GroupInviteScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListFriends.mockReset();
    mockCreateInvitation.mockReset();
    mockListFriends.mockResolvedValue([friendA, friendB, friendC]);
  });

  test('친구 목록 fetch + 렌더', async () => {
    const { findByText } = render(<GroupInviteScreen />, { wrapper });
    expect(await findByText('홍길동')).toBeTruthy();
    expect(await findByText('김영희')).toBeTruthy();
    expect(await findByText('이몽룡')).toBeTruthy();
  });

  test('친구 0명 → 빈 상태 + 친구 검색 CTA', async () => {
    mockListFriends.mockResolvedValueOnce([]);
    const { findByTestId } = render(<GroupInviteScreen />, { wrapper });
    expect(await findByTestId('invite-empty-state')).toBeTruthy();
  });

  test('초대 CTA 기본 disabled, 친구 선택 시 활성 + 카운트', async () => {
    const { findByTestId, getByTestId } = render(<GroupInviteScreen />, { wrapper });
    const cta = await findByTestId('invite-submit-button');
    expect(cta.props.accessibilityState?.disabled).toBe(true);

    await act(async () => {
      fireEvent.press(getByTestId('invite-friend-u-a'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('invite-friend-u-b'));
    });
    const cta2 = getByTestId('invite-submit-button');
    expect(cta2.props.accessibilityState?.disabled).toBe(false);
    expect(cta2.props.accessibilityLabel).toContain('2');
  });

  test('친구 재탭 → 선택 해제 (toggle)', async () => {
    const { findByTestId, getByTestId } = render(<GroupInviteScreen />, { wrapper });
    await findByTestId('invite-friend-u-a');
    await act(async () => {
      fireEvent.press(getByTestId('invite-friend-u-a'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('invite-friend-u-a'));
    });
    const cta = getByTestId('invite-submit-button');
    expect(cta.props.accessibilityState?.disabled).toBe(true);
  });

  test('초대하기 → 선택된 친구 모두 createInvitation 호출 + 성공 토스트 + back', async () => {
    mockCreateInvitation.mockResolvedValue(undefined);
    const { findByTestId, getByTestId, findByText } = render(<GroupInviteScreen />, { wrapper });

    await findByTestId('invite-friend-u-a');
    await act(async () => {
      fireEvent.press(getByTestId('invite-friend-u-a'));
      fireEvent.press(getByTestId('invite-friend-u-b'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('invite-submit-button'));
    });

    await waitFor(() => {
      expect(mockCreateInvitation).toHaveBeenCalledTimes(2);
    });
    expect(mockCreateInvitation).toHaveBeenCalledWith({ groupId: 'g-1', inviteeId: 'u-a' });
    expect(mockCreateInvitation).toHaveBeenCalledWith({ groupId: 'g-1', inviteeId: 'u-b' });
    expect(await findByText('2명에게 초대를 보냈어요!')).toBeTruthy();
    expect(mockBack).toHaveBeenCalled();
  });

  test('일부 createInvitation 실패 → 부분 성공/실패 토스트 + back 호출', async () => {
    mockCreateInvitation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('이미 초대했어요.'));
    const { findByTestId, getByTestId, findByText } = render(<GroupInviteScreen />, { wrapper });

    await findByTestId('invite-friend-u-a');
    await act(async () => {
      fireEvent.press(getByTestId('invite-friend-u-a'));
      fireEvent.press(getByTestId('invite-friend-u-b'));
    });
    await act(async () => {
      fireEvent.press(getByTestId('invite-submit-button'));
    });

    await waitFor(() => {
      expect(mockCreateInvitation).toHaveBeenCalledTimes(2);
    });
    expect(await findByText(/1명 성공/)).toBeTruthy();
    expect(mockBack).toHaveBeenCalled();
  });

  test('친구 fetch 실패 → EmptyState error + 다시 시도 refetch (W1-10)', async () => {
    mockListFriends.mockRejectedValueOnce(new Error('boom'));
    const { findByTestId, getByTestId, findByText } = render(<GroupInviteScreen />, { wrapper });
    expect(await findByTestId('invite-error')).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId('invite-error-cta'));
    });
    expect(await findByText('홍길동')).toBeTruthy();
  });

  test('뒤로 가기', async () => {
    const { findByTestId, getByTestId } = render(<GroupInviteScreen />, { wrapper });
    await findByTestId('invite-friend-u-a');
    fireEvent.press(getByTestId('back-button'));
    expect(mockBack).toHaveBeenCalled();
  });

  test('빈 상태에서 친구 검색 CTA → /friends/search push', async () => {
    mockListFriends.mockResolvedValueOnce([]);
    const { findByTestId, getByTestId } = render(<GroupInviteScreen />, { wrapper });
    await findByTestId('invite-empty-state');
    await act(async () => {
      fireEvent.press(getByTestId('invite-empty-search-cta'));
    });
    expect(mockPush).toHaveBeenCalledWith('/friends/search');
  });
});
