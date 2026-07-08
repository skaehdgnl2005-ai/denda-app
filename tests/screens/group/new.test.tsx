import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import NewGroupScreen from '../../../app/group/new';
import { ThemeProvider } from '@/design/theme';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
}));

const mockCreateGroup = jest.fn();
jest.mock('@/lib/groups/create', () => ({
  createGroup: (...args: unknown[]) => mockCreateGroup(...args),
}));

describe('NewGroupScreen', () => {
  const wrapper = ThemeProvider;
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

  test('createGroup throw → Alert 노출, navigation 없음', async () => {
    mockCreateGroup.mockRejectedValue(
      new Error('모임을 만들지 못했어요. 잠시 후 다시 시도해주세요.'),
    );
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });

    fireEvent.changeText(getByTestId('group-name-input'), 'g');
    fireEvent.press(getByTestId('calendar-today'));
    await act(async () => {
      fireEvent.press(getByTestId('create-group-submit'));
    });

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(mockReplace).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
