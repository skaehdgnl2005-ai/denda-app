// S22 — 호스트 인앱 모임 초대 화면 (multi-select → batch createInvitation)
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import GroupInviteScreen from '../../../app/group/[id]/invite';
import { ThemeProvider } from '@/design/theme';
import type { FriendUser } from '@/lib/friends/api';

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

describe('GroupInviteScreen', () => {
  const wrapper = ThemeProvider;

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

  test('초대하기 → 선택된 친구 모두 createInvitation 호출 + 성공 Alert + back', async () => {
    mockCreateInvitation.mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByTestId, getByTestId } = render(<GroupInviteScreen />, { wrapper });

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
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
    expect(mockBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('일부 createInvitation 실패 → 부분 성공/실패 Alert + back 호출', async () => {
    mockCreateInvitation
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('이미 초대했어요.'));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { findByTestId, getByTestId } = render(<GroupInviteScreen />, { wrapper });

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
      expect(alertSpy).toHaveBeenCalled();
    });
    // Title 또는 메시지에 "일부" 또는 "1명" 형태로 부분 결과 노출
    const lastCall = alertSpy.mock.calls.at(-1) ?? [];
    const combined = String(lastCall[0] ?? '') + ' ' + String(lastCall[1] ?? '');
    expect(combined).toMatch(/일부|보내지|실패|1/);
    expect(mockBack).toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('친구 fetch 실패 → 에러 메시지', async () => {
    mockListFriends.mockRejectedValueOnce(new Error('친구 목록을 불러오지 못했어요.'));
    const { findByText } = render(<GroupInviteScreen />, { wrapper });
    expect(await findByText(/불러오지 못했어요/)).toBeTruthy();
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
