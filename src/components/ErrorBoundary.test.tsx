// 루트 ErrorBoundary — 렌더 크래시 시 앱 전체 white-screen 대신 한국어 폴백 + 다시 시도.
// 베타 관측 수단이 logcat뿐이므로 console.error로 스택 보존이 계약의 일부다.

import React from 'react';
import { Text, View } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './ErrorBoundary';
import { ThemeProvider } from '@/design/theme';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const wrapper = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ThemeProvider>{children}</ThemeProvider>
  </SafeAreaProvider>
);

function Bomb({ shouldThrow }: { shouldThrow: boolean }): React.JSX.Element {
  if (shouldThrow) throw new Error('render 폭발');
  return <Text>정상 콘텐츠</Text>;
}

describe('ErrorBoundary', () => {
  // React가 캐치된 렌더 에러도 console.error로 재출력 — 테스트 로그 소음만 억제.
  let consoleErrorSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('에러 없으면 children 그대로 렌더', () => {
    const { getByText, queryByText } = render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
      { wrapper },
    );
    expect(getByText('정상 콘텐츠')).toBeTruthy();
    expect(queryByText('문제가 생겼어요')).toBeNull();
  });

  test('자식 렌더 throw → 한국어 폴백 화면 + 다시 시도 버튼', () => {
    const { getByText, getByTestId } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
      { wrapper },
    );
    expect(getByText('문제가 생겼어요')).toBeTruthy();
    expect(getByTestId('error-boundary-fallback-cta')).toBeTruthy();
  });

  test('크래시 스택을 console.error로 보존 (logcat 판독 계약)', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
      { wrapper },
    );
    const logged = consoleErrorSpy.mock.calls.some((call) =>
      call.some((arg: unknown) => arg instanceof Error && arg.message === 'render 폭발'),
    );
    expect(logged).toBe(true);
  });

  test('다시 시도 press → 원인 해소된 children 재렌더', () => {
    // 첫 렌더는 throw, 재시도 시점엔 원인 해소 — "일시 상태 크래시 → 복구" 시나리오.
    // 렌더 중 읽는 외부 플래그로 결정적 제어 (useState 초기화 부수효과는 React의
    // 이중 렌더 시도와 얽혀 비결정적).
    let shouldExplode = true;
    function Recoverable(): React.JSX.Element {
      if (shouldExplode) throw new Error('첫 렌더만 폭발');
      return (
        <View>
          <Text>복구된 콘텐츠</Text>
        </View>
      );
    }

    const { getByText, getByTestId } = render(
      <ErrorBoundary>
        <Recoverable />
      </ErrorBoundary>,
      { wrapper },
    );
    expect(getByText('문제가 생겼어요')).toBeTruthy();

    shouldExplode = false;
    fireEvent.press(getByTestId('error-boundary-fallback-cta'));
    expect(getByText('복구된 콘텐츠')).toBeTruthy();
  });
});
