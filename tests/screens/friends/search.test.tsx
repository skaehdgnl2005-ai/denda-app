import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import FriendsSearchScreen from '../../../app/(tabs)/friends/search';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { friendsApi } from '@/lib/friends/api';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

// W1-15: 카톡 초대는 공유 훅으로 위임 — 훅 자체는 useKakaoInvite.test.ts에서 검증.
const mockInvite = jest.fn();
jest.mock('@/lib/share/useKakaoInvite', () => ({
  useKakaoInvite: () => mockInvite,
}));

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

describe('FriendsSearchScreen Screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    friendsApi.__resetMocks();
    // S21: search/sendRequest spy로 기본 응답 — 각 test가 mockResolvedValueOnce로 override
    jest.spyOn(friendsApi, 'search').mockResolvedValue([]);
    jest.spyOn(friendsApi, 'sendRequest').mockResolvedValue(undefined);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('calls search API after 300ms debounce and displays results', async () => {
    const searchSpy = jest
      .spyOn(friendsApi, 'search')
      .mockResolvedValueOnce([{ id: 'user-10', nickname: '김하늘' }]);

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });

    const input = getByTestId('search-input-field');
    fireEvent.changeText(input, '김하늘');

    expect(searchSpy).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(searchSpy).toHaveBeenCalledWith('김하늘');

    await waitFor(() => {
      expect(getByText('김하늘')).toBeTruthy();
    });
  });

  test('sends friend request on button press and updates button text to sent state', async () => {
    jest.spyOn(friendsApi, 'search').mockResolvedValueOnce([{ id: 'user-10', nickname: '김하늘' }]);
    const sendRequestSpy = jest.spyOn(friendsApi, 'sendRequest');

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });

    const input = getByTestId('search-input-field');
    fireEvent.changeText(input, '김하늘');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByText('김하늘')).toBeTruthy();
    });

    const reqButton = getByTestId('send-request-button');
    expect(getByText('친구 요청')).toBeTruthy();

    await act(async () => {
      fireEvent.press(reqButton);
    });

    expect(sendRequestSpy).toHaveBeenCalledWith('user-10');
    // 시스템 Alert 대신 success 토스트
    expect(getByText('요청 보냈어요!')).toBeTruthy();
    expect(getByText('요청 보냄')).toBeTruthy();
    expect(reqButton.props.accessibilityState.disabled).toBe(true);
  });

  test('W2-10 — 응답 전 더블탭은 sendRequest를 1번만 호출(in-flight 잠금)', async () => {
    jest.spyOn(friendsApi, 'search').mockResolvedValueOnce([{ id: 'user-10', nickname: '김하늘' }]);
    let resolveSend: () => void = () => {};
    const sendRequestSpy = jest
      .spyOn(friendsApi, 'sendRequest')
      .mockImplementation(
        () =>
          new Promise<void>((res) => {
            resolveSend = () => res();
          }),
      );

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });
    fireEvent.changeText(getByTestId('search-input-field'), '김하늘');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(getByText('김하늘')).toBeTruthy();
    });

    const reqButton = getByTestId('send-request-button');
    fireEvent.press(reqButton);
    fireEvent.press(reqButton); // 응답 전 두 번째 탭 — 가드로 무시돼야 함
    expect(sendRequestSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSend();
    });
  });

  test('W2-10 — 검색 결과 없음 빈 상태 CTA → useKakaoInvite', async () => {
    jest.spyOn(friendsApi, 'search').mockResolvedValueOnce([]);
    const { getByTestId } = render(<FriendsSearchScreen />, { wrapper });
    fireEvent.changeText(getByTestId('search-input-field'), '없는닉네임');
    act(() => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => {
      expect(getByTestId('search-empty-invite')).toBeTruthy();
    });
    fireEvent.press(getByTestId('search-empty-invite'));
    expect(mockInvite).toHaveBeenCalledTimes(1);
  });

  // W1-15: 초대 카드가 더 이상 no-op이 아니라 공유 훅을 실행.
  test('W1-15: 카톡 초대 카드 → useKakaoInvite 실행', () => {
    const { getByTestId } = render(<FriendsSearchScreen />, { wrapper });
    fireEvent.press(getByTestId('kakao-invite-card'));
    expect(mockInvite).toHaveBeenCalledTimes(1);
  });

  test('navigates back on back button press', () => {
    const { getByLabelText } = render(<FriendsSearchScreen />, { wrapper });
    const backBtn = getByLabelText('뒤로 가기');

    fireEvent.press(backBtn);
    expect(mockBack).toHaveBeenCalled();
  });

  test('renders empty state when no results found', async () => {
    jest.spyOn(friendsApi, 'search').mockResolvedValueOnce([]);

    const { getByTestId, getByText } = render(<FriendsSearchScreen />, { wrapper });

    const input = getByTestId('search-input-field');
    fireEvent.changeText(input, '없는유저');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(getByTestId('search-empty-state')).toBeTruthy();
      expect(getByText('검색 결과가 없어요')).toBeTruthy();
    });
  });
});
