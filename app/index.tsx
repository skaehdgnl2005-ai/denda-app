// 라우팅 게이트 — 인증 상태에 따라 분기. 결정 로직은 src/lib/auth/gate.ts.

import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { decideGate } from '@/lib/auth/gate';
import { useAuth } from '@/lib/auth/setup';

export default function IndexRoute() {
  const decision = useAuth((s) =>
    decideGate({
      status: s.status,
      hasAgreedToTerms: s.hasAgreedToTerms,
      hasCompletedOnboarding: s.hasCompletedOnboarding,
    }),
  );

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
