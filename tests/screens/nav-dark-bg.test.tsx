// W2-2 — 다크 네비 배경. 각 nested Stack이 contentStyle.backgroundColor=surface-0을
// 설정하는지 캡처 검증(다크 전환 시 라이트 배경 flash 제거). 루트 _layout은 부수효과
// import가 많은 glue라 동일 패턴을 tsc + 본 nested 검증으로 대체.
import React from 'react';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';
import GroupLayout from '../../app/group/_layout';
import ScheduleLayout from '../../app/schedule/_layout';
import AuthLayout from '../../app/(auth)/_layout';
import FriendsLayout from '../../app/(tabs)/friends/_layout';

let mockCapturedOptions: Record<string, unknown> | undefined;

jest.mock('expo-router', () => {
  const StackMock = ({ screenOptions }: { screenOptions?: Record<string, unknown> }): null => {
    mockCapturedOptions = screenOptions;
    return null;
  };
  StackMock.displayName = 'Stack';
  StackMock.Screen = function StackScreen(): null {
    return null;
  };
  return { Stack: StackMock };
});

const L = tokens.light;
const wrapper = ThemeProvider;
const bg = (): unknown =>
  (mockCapturedOptions?.contentStyle as { backgroundColor?: unknown } | undefined)?.backgroundColor;

describe('W2-2 다크 네비 배경 — nested _layout contentStyle=surface-0', () => {
  beforeEach(() => {
    mockCapturedOptions = undefined;
  });

  test('GroupLayout — surface-0 + slide_from_right 유지', () => {
    render(<GroupLayout />, { wrapper });
    expect(bg()).toBe(L.surface[0]);
    expect(mockCapturedOptions?.animation).toBe('slide_from_right');
    expect(mockCapturedOptions?.headerShown).toBe(false);
  });

  test('ScheduleLayout — surface-0 + slide_from_right 유지', () => {
    render(<ScheduleLayout />, { wrapper });
    expect(bg()).toBe(L.surface[0]);
    expect(mockCapturedOptions?.animation).toBe('slide_from_right');
  });

  test('AuthLayout — surface-0 + fade 의도 보존', () => {
    render(<AuthLayout />, { wrapper });
    expect(bg()).toBe(L.surface[0]);
    expect(mockCapturedOptions?.animation).toBe('fade');
  });

  test('FriendsLayout — surface-0 배경', () => {
    render(<FriendsLayout />, { wrapper });
    expect(bg()).toBe(L.surface[0]);
    expect(mockCapturedOptions?.headerShown).toBe(false);
  });
});
