// 루트 ErrorBoundary — 렌더 크래시 시 앱 전체 white-screen 대신 한국어 폴백 + 다시 시도.
// 베타 관측 수단이 logcat/Console.app뿐이므로 componentDidCatch에서 console.error로 스택 보존
// (Sentry 도입 시 이 지점만 교체). 폴백 UI는 EmptyState error variant 재사용 (D4/D5 토큰 준수).

import React from 'react';
import { View } from 'react-native';

import { EmptyState } from './EmptyState';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // eslint-disable-next-line no-console -- 베타: logcat 스택 보존 (Sentry 도입 시 교체 지점)
    console.error('[ErrorBoundary] 렌더 크래시', error, info.componentStack);
  }

  private readonly handleRetry = (): void => {
    this.setState({ hasError: false });
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <EmptyState
            variant="error"
            title="문제가 생겼어요"
            body="잠시 후 다시 시도해주세요"
            cta={{ label: '다시 시도', onPress: this.handleRetry }}
            testID="error-boundary-fallback"
          />
        </View>
      );
    }
    return this.props.children;
  }
}
