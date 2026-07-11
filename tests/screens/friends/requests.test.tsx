import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsRequestsScreen from '../../../app/(tabs)/friends/requests';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { friendsApi } from '@/lib/friends/api';
import { invitationsApi } from '@/lib/groups/invitations';

const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

const DEFAULT_INVITATIONS = [
  {
    id: 'inv-1',
    group_id: 'g-1',
    inviter_id: 'user-8',
    invitee_id: 'me',
    status: 'pending' as const,
    created_at: '2026-05-25T12:00:00Z',
    group: { id: 'g-1', name: '점심 모임' },
    inviter: { id: 'user-8', nickname: '강하나' },
  },
  {
    id: 'inv-2',
    group_id: 'g-2',
    inviter_id: 'user-9',
    invitee_id: 'me',
    status: 'pending' as const,
    created_at: '2026-05-24T12:00:00Z',
    group: { id: 'g-2', name: '저녁 모임' },
    inviter: { id: 'user-9', nickname: '윤지호' },
  },
];

// S21: friendsApi가 supabase로 전면 교체됨 — mock data는 spy로 명시.
const DEFAULT_INCOMING = [
  {
    id: 'req-1',
    sender_id: 'user-5',
    receiver_id: 'me',
    sender: { id: 'user-5', nickname: '박민수' },
    created_at: '2026-05-23T10:00:00Z',
  },
  {
    id: 'req-2',
    sender_id: 'user-6',
    receiver_id: 'me',
    sender: { id: 'user-6', nickname: '최수지' },
    created_at: '2026-05-23T11:30:00Z',
  },
];
const DEFAULT_OUTGOING = [
  {
    id: 'req-3',
    sender_id: 'me',
    receiver_id: 'user-7',
    receiver: { id: 'user-7', nickname: '정다은' },
    created_at: '2026-05-23T09:15:00Z',
  },
];

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

describe('FriendsRequestsScreen Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    friendsApi.__resetMocks();
    jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValue([...DEFAULT_INCOMING]);
    jest.spyOn(friendsApi, 'listOutgoingRequests').mockResolvedValue([...DEFAULT_OUTGOING]);
    jest.spyOn(friendsApi, 'acceptRequest').mockResolvedValue(undefined);
    jest.spyOn(friendsApi, 'rejectRequest').mockResolvedValue(undefined);
    jest.spyOn(friendsApi, 'cancelRequest').mockResolvedValue(undefined);
    jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValue([...DEFAULT_INVITATIONS]);
    jest.spyOn(invitationsApi, 'acceptInvitation').mockResolvedValue({ groupId: 'g-1' });
    jest.spyOn(invitationsApi, 'rejectInvitation').mockResolvedValue(undefined);
  });

  test('renders incoming requests by default', async () => {
    const { getByText, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
      expect(getByText('최수지')).toBeTruthy();
    });

    const cards = getAllByTestId('friend-request-card');
    expect(cards.length).toBe(2);
  });

  // W3-5: 3개 조건부 밑줄 → 단일 슬라이딩 인디케이터(translateX). 레이아웃(폭) 측정 후 렌더.
  test('W3-5 — 탭바 레이아웃 후 단일 슬라이딩 인디케이터가 렌더된다', async () => {
    const { getByTestId, queryByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    await waitFor(() => expect(getByTestId('requests-tabbar')).toBeTruthy());
    expect(queryByTestId('tab-indicator')).toBeNull(); // 폭 측정 전
    await act(async () => {
      fireEvent(getByTestId('requests-tabbar'), 'layout', {
        nativeEvent: { layout: { width: 300, height: 44, x: 0, y: 0 } },
      });
    });
    expect(getByTestId('tab-indicator')).toBeTruthy(); // 단일 인디케이터
  });

  test('switches tab to outgoing requests and displays them', async () => {
    const { getByText, getByTestId, getAllByTestId } = render(<FriendsRequestsScreen />, {
      wrapper,
    });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const outgoingTab = getByTestId('outgoing-tab');
    fireEvent.press(outgoingTab);

    await waitFor(() => {
      expect(getByText('정다은')).toBeTruthy();
    });

    const cards = getAllByTestId('friend-request-card');
    expect(cards.length).toBe(1);
  });

  test('handles accept request flow → success 토스트', async () => {
    const acceptSpy = jest.spyOn(friendsApi, 'acceptRequest');

    const { getByText, getAllByTestId, findByText } = render(<FriendsRequestsScreen />, {
      wrapper,
    });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const acceptButtons = getAllByTestId('accept-button');
    await act(async () => {
      fireEvent.press(acceptButtons[0]!);
    });

    // S23: sender_id 전달 → F2 push 대상 식별 (수락 사실을 원 sender에게 알림)
    expect(acceptSpy).toHaveBeenCalledWith('req-1', 'user-5');
    expect(await findByText('친구 요청을 수락했어요.')).toBeTruthy();
  });

  test('handles reject request flow → 토스트', async () => {
    const rejectSpy = jest.spyOn(friendsApi, 'rejectRequest');

    const { getByText, getAllByTestId, findByText } = render(<FriendsRequestsScreen />, {
      wrapper,
    });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const rejectButtons = getAllByTestId('reject-button');
    await act(async () => {
      fireEvent.press(rejectButtons[0]!);
    });

    expect(rejectSpy).toHaveBeenCalledWith('req-1');
    expect(await findByText('친구 요청을 거절했어요.')).toBeTruthy();
  });

  test('handles cancel request flow in outgoing tab → 토스트', async () => {
    const cancelSpy = jest.spyOn(friendsApi, 'cancelRequest');

    const { getByText, getByTestId, getAllByTestId, findByText } = render(
      <FriendsRequestsScreen />,
      { wrapper },
    );

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    const outgoingTab = getByTestId('outgoing-tab');
    fireEvent.press(outgoingTab);

    await waitFor(() => {
      expect(getByText('정다은')).toBeTruthy();
    });

    const cancelButtons = getAllByTestId('cancel-button');
    await act(async () => {
      fireEvent.press(cancelButtons[0]!);
    });

    expect(cancelSpy).toHaveBeenCalledWith('req-3');
    expect(await findByText('보낸 요청을 취소했어요.')).toBeTruthy();
  });

  test('navigates back on back button press', () => {
    const { getByLabelText } = render(<FriendsRequestsScreen />, { wrapper });
    const backBtn = getByLabelText('뒤로 가기');

    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  test('S22: switches to invitations tab → 모임 초대 list 렌더', async () => {
    const { getByText, getByTestId, getAllByTestId } = render(<FriendsRequestsScreen />, {
      wrapper,
    });

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    fireEvent.press(getByTestId('invitations-tab'));

    await waitFor(() => {
      expect(getByText('점심 모임')).toBeTruthy();
      expect(getByText('저녁 모임')).toBeTruthy();
    });

    const cards = getAllByTestId('group-invitation-card');
    expect(cards.length).toBe(2);
  });

  test('S22: accept invitation → 합류 success 토스트 + group 화면 navigation', async () => {
    const acceptSpy = jest.spyOn(invitationsApi, 'acceptInvitation');

    const { getByText, getByTestId, getAllByTestId, findByText } = render(
      <FriendsRequestsScreen />,
      { wrapper },
    );

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    fireEvent.press(getByTestId('invitations-tab'));
    await waitFor(() => {
      expect(getByText('점심 모임')).toBeTruthy();
    });

    const acceptBtns = getAllByTestId('invitation-accept-button');
    await act(async () => {
      fireEvent.press(acceptBtns[0]!);
    });

    expect(acceptSpy).toHaveBeenCalledWith('inv-1');
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/group/g-1');
    });
    expect(await findByText('모임에 합류했어요!')).toBeTruthy();
  });

  test('S22: reject invitation → rejectInvitation 호출 + 토스트', async () => {
    const rejectSpy = jest.spyOn(invitationsApi, 'rejectInvitation');

    const { getByText, getByTestId, getAllByTestId, findByText } = render(
      <FriendsRequestsScreen />,
      { wrapper },
    );

    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });

    fireEvent.press(getByTestId('invitations-tab'));
    await waitFor(() => {
      expect(getByText('점심 모임')).toBeTruthy();
    });

    const rejectBtns = getAllByTestId('invitation-reject-button');
    await act(async () => {
      fireEvent.press(rejectBtns[0]!);
    });

    expect(rejectSpy).toHaveBeenCalledWith('inv-1');
    expect(await findByText('모임 초대를 거절했어요.')).toBeTruthy();
  });

  test('S22: invitations 빈 상태 → empty state 노출', async () => {
    jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValueOnce([]);
    const { getByText, getByTestId, findByTestId } = render(<FriendsRequestsScreen />, {
      wrapper,
    });
    await waitFor(() => {
      expect(getByText('박민수')).toBeTruthy();
    });
    fireEvent.press(getByTestId('invitations-tab'));
    expect(await findByTestId('requests-empty-state')).toBeTruthy();
  });

  // W2-10 — in-flight 잠금: 응답 전 더블탭이 acceptRequest를 2번 호출하지 않도록 pending Set 가드.
  test('W2-10 — 수락 응답 전 더블탭은 acceptRequest를 1번만 호출', async () => {
    let resolveAccept: () => void = () => {};
    const acceptSpy = jest
      .spyOn(friendsApi, 'acceptRequest')
      .mockImplementation(() => new Promise<void>((res) => (resolveAccept = () => res())));

    const { getByText, getAllByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    await waitFor(() => expect(getByText('박민수')).toBeTruthy());

    const acceptButtons = getAllByTestId('accept-button');
    fireEvent.press(acceptButtons[0]!);
    fireEvent.press(acceptButtons[0]!); // 응답 전 두 번째 탭 — 가드로 무시돼야 함
    expect(acceptSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAccept();
    });
  });

  test('W2-10 — 초대 수락 응답 전 더블탭은 acceptInvitation을 1번만 호출', async () => {
    let resolveAccept: (v: { groupId: string }) => void = () => {};
    const acceptSpy = jest
      .spyOn(invitationsApi, 'acceptInvitation')
      .mockImplementation(() => new Promise<{ groupId: string }>((res) => (resolveAccept = res)));

    const { getByText, getByTestId, getAllByTestId } = render(<FriendsRequestsScreen />, {
      wrapper,
    });
    await waitFor(() => expect(getByText('박민수')).toBeTruthy());
    fireEvent.press(getByTestId('invitations-tab'));
    await waitFor(() => expect(getByText('점심 모임')).toBeTruthy());

    const acceptBtns = getAllByTestId('invitation-accept-button');
    fireEvent.press(acceptBtns[0]!);
    fireEvent.press(acceptBtns[0]!);
    expect(acceptSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAccept({ groupId: 'g-1' });
    });
  });

  // W2-10 — pull-to-refresh: 리스트를 당겨서 최신 요청/초대를 다시 불러온다.
  test('W2-10 — requests 리스트 pull-to-refresh → refetch', async () => {
    const spy = jest.spyOn(friendsApi, 'listIncomingRequests');
    const { getByText, getByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    await waitFor(() => expect(getByText('박민수')).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(1);

    const list = getByTestId('requests-list');
    await act(async () => {
      await list.props.refreshControl.props.onRefresh();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test('W2-10 — invitations 리스트 pull-to-refresh → refetch', async () => {
    const spy = jest.spyOn(invitationsApi, 'listMyInvitations');
    const { getByText, getByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    await waitFor(() => expect(getByText('박민수')).toBeTruthy());
    fireEvent.press(getByTestId('invitations-tab'));
    await waitFor(() => expect(getByText('점심 모임')).toBeTruthy());
    expect(spy).toHaveBeenCalledTimes(1);

    const list = getByTestId('invitations-list');
    await act(async () => {
      await list.props.refreshControl.props.onRefresh();
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  // W2-10 — 빈 상태 CTA (§11.2 막다른 곳 탈출구)
  test('W2-10 — 받은 요청 없음 빈 상태 → 친구 검색하기 CTA', async () => {
    jest.spyOn(friendsApi, 'listIncomingRequests').mockResolvedValueOnce([]);
    const { findByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    const cta = await findByTestId('empty-search-cta');
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/friends/search');
  });

  test('W2-10 — 모임 초대 없음 빈 상태 → 모임 만들기 CTA', async () => {
    jest.spyOn(invitationsApi, 'listMyInvitations').mockResolvedValueOnce([]);
    const { getByText, getByTestId, findByTestId } = render(<FriendsRequestsScreen />, { wrapper });
    await waitFor(() => expect(getByText('박민수')).toBeTruthy());
    fireEvent.press(getByTestId('invitations-tab'));
    const cta = await findByTestId('empty-create-group-cta');
    fireEvent.press(cta);
    expect(mockPush).toHaveBeenCalledWith('/group/new');
  });
});
