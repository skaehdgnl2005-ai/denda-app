import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NewGroupScreen from '../../../app/group/new';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

const mockCreateGroup = jest.fn();
jest.mock('@/lib/groups/create', () => ({
  createGroup: (...args: unknown[]) => mockCreateGroup(...args),
}));

const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  </SafeAreaProvider>
);

describe('NewGroupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateGroup.mockReset();
  });

  test('이름 미입력·날짜 미선택이면 만들기 버튼 비활성', () => {
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });
    expect(getByTestId('create-group-submit').props.accessibilityState?.disabled).toBe(true);
  });

  test('이름 입력 + 날짜 선택 → createGroup 호출 + 성공 시 그리드로 replace', async () => {
    mockCreateGroup.mockResolvedValue({ id: 'g-123' });
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });

    fireEvent.changeText(getByTestId('group-name-input'), '5/30 저녁');
    fireEvent.press(getByTestId('calendar-today'));

    await act(async () => {
      fireEvent.press(getByTestId('create-group-submit'));
    });

    await waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledTimes(1);
      const arg = mockCreateGroup.mock.calls[0][0];
      expect(arg.name).toBe('5/30 저녁');
      expect(arg.dates).toHaveLength(1);
      expect(mockReplace).toHaveBeenCalledWith('/group/g-123');
    });
  });

  test('createGroup throw → 에러 토스트(raw 비노출), navigation 없음', async () => {
    // raw-스러운 메시지가 mapError로 큐레이션 카피로 치환되는지(비노출) 검증.
    mockCreateGroup.mockRejectedValue(new Error('DB unique violation xyz'));
    const { getByTestId, findByText } = render(<NewGroupScreen />, { wrapper });

    fireEvent.changeText(getByTestId('group-name-input'), 'g');
    fireEvent.press(getByTestId('calendar-today'));
    await act(async () => {
      fireEvent.press(getByTestId('create-group-submit'));
    });

    expect(await findByText('문제가 생겼어요. 잠시 후 다시 시도해볼게요.')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
