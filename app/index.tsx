// 라우팅 게이트 — 인증 상태에 따라 분기. 결정 로직은 src/lib/auth/gate.ts.

import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { decideGate } from '@/lib/auth/gate';
import { useAuth } from '@/lib/auth/setup';

export default function IndexRoute() {
  // useSyncExternalStore는 selector가 매 호출 같은 reference를 리턴해야 한다
  // (그렇지 않으면 "getSnapshot should be cached" 경고). 따라서 primitive 3개를
  // 따로 구독하고 decideGate는 render에서 계산한다.
  const status = useAuth((s) => s.status);
  const hasAgreedToTerms = useAuth((s) => s.hasAgreedToTerms);
  const hasCompletedOnboarding = useAuth((s) => s.hasCompletedOnboarding);
  const decision = decideGate({ status, hasAgreedToTerms, hasCompletedOnboarding });

  switch (decision.kind) {
    case 'splash':
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator />
        </View>
      );
    case 'login':
      return <Redirect href="/(auth)/login" />;
    case 'terms':
      return <Redirect href="/(auth)/terms" />;
    case 'onboarding':
      return <Redirect href="/(auth)/onboarding" />;
    case 'home':
      return <Redirect href="/(tabs)" />;
  }
}
