import React from 'react';
import { KeyboardAvoidingView } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NewGroupScreen from '../../../app/group/new';
import { ThemeProvider } from '@/design/theme';
import { ToastProvider } from '@/components/Toast';
import { tokens } from '@/design/tokens';

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

// 결정적 캘린더: KST 오늘을 2026-03-10로 고정 → 같은 달(2026-03) 미래 셀 다수 확보.
jest.mock('@/lib/groups/dateOptions', () => ({
  ...jest.requireActual('@/lib/groups/dateOptions'),
  todayKstIso: (): string => '2026-03-10',
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

  // W2-12 (a) 이름 입력 접근성 라벨
  test('이름 입력에 accessibilityLabel="모임 이름"', () => {
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });
    expect(getByTestId('group-name-input').props.accessibilityLabel).toBe('모임 이름');
  });

  // W2-12 (b) 활성 CTA borderRadius = radius.md
  test('활성 CTA borderRadius = radius.md', () => {
    const { getByTestId } = render(<NewGroupScreen />, { wrapper });
    fireEvent.changeText(getByTestId('group-name-input'), 'g');
    fireEvent.press(getByTestId('calendar-today'));

    const style = getByTestId('create-group-submit').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
    expect(flat.borderRadius).toBe(tokens.radius.md);
  });

  // W2-12 (d) 키보드 회피 뷰 존재
  test('KeyboardAvoidingView가 존재해 CTA가 키보드 위로 올라온다', () => {
    const { UNSAFE_getByType } = render(<NewGroupScreen />, { wrapper });
    expect(UNSAFE_getByType(KeyboardAvoidingView)).toBeTruthy();
  });

  // W2-12 (c) 최대치 초과 추가 → 토스트 1회 · 선택 유지 · createGroup 미호출
  test('7일 선택 후 8번째 새 날짜 탭 → "최대 7일까지 골라요" 토스트, 선택 7 유지', async () => {
    const { getByTestId, findByText } = render(<NewGroupScreen />, { wrapper });

    // 2026-03-11 ~ 2026-03-17 (미래 7일) 선택
    for (let d = 11; d <= 17; d += 1) {
      fireEvent.press(getByTestId(`calendar-day-2026-03-${d}`));
    }
    // 8번째 새 날짜 → 거부 + 토스트
    fireEvent.press(getByTestId('calendar-day-2026-03-18'));

    expect(await findByText('최대 7일까지 골라요')).toBeTruthy();
    // 8번째는 선택되지 않고, 기존 7일은 유지
    expect(getByTestId('calendar-day-2026-03-18').props.accessibilityState?.selected).toBe(false);
    expect(getByTestId('calendar-day-2026-03-11').props.accessibilityState?.selected).toBe(true);
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  // W2-12 (c) 이미 고른 날짜 해제는 토스트하지 않는다
  test('선택된 날짜 해제 시에는 초과 토스트가 뜨지 않는다', () => {
    const { getByTestId, queryByText } = render(<NewGroupScreen />, { wrapper });

    for (let d = 11; d <= 17; d += 1) {
      fireEvent.press(getByTestId(`calendar-day-2026-03-${d}`));
    }
    // 이미 고른 날짜(11일) 다시 탭 → 해제 (delete 분기, 토스트 없음)
    fireEvent.press(getByTestId('calendar-day-2026-03-11'));

    expect(queryByText('최대 7일까지 골라요')).toBeNull();
    expect(getByTestId('calendar-day-2026-03-11').props.accessibilityState?.selected).toBe(false);
  });
});
