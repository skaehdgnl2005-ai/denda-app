// 라우팅 게이트 — 인증 상태에 따라 분기. 결정 로직은 src/lib/auth/gate.ts.

import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { BrandMark } from '@/components/brand/BrandMark';
import { Spinner } from '@/components/Spinner';
import { useTheme } from '@/design/theme';
import { decideGate } from '@/lib/auth/gate';
import { useAuth } from '@/lib/auth/setup';

export default function IndexRoute() {
  // useSyncExternalStore는 selector가 매 호출 같은 reference를 리턴해야 한다
  // (그렇지 않으면 "getSnapshot should be cached" 경고). 따라서 primitive 3개를
  // 따로 구독하고 decideGate는 render에서 계산한다.
  const { colors, space } = useTheme();
  const status = useAuth((s) => s.status);
  const hasAgreedToTerms = useAuth((s) => s.hasAgreedToTerms);
  const hasCompletedOnboarding = useAuth((s) => s.hasCompletedOnboarding);
  // undefined(프로필 조회 전)와 null(미설정)은 다른 의미다 — gate.ts 참조.
  const nicknameSetAt = useAuth((s) => s.session?.user.nicknameSetAt);
  const decision = decideGate({
    status,
    hasAgreedToTerms,
    hasCompletedOnboarding,
    nicknameSetAt,
  });

  switch (decision.kind) {
    case 'splash':
      // §17.4: surface-0 배경(다크에서 흰 flash 제거) + BrandMark + Spinner.
      return (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface[0],
          }}
          testID="splash-gate"
        >
          <BrandMark size="lg" />
          <View style={{ marginTop: space[6] }}>
            <Spinner />
          </View>
        </View>
      );
    case 'login':
      return <Redirect href="/(auth)/login" />;
    case 'terms':
      return <Redirect href="/(auth)/terms" />;
    case 'nickname':
      return <Redirect href="/(auth)/nickname" />;
    case 'onboarding':
      return <Redirect href="/(auth)/onboarding" />;
    case 'home':
      return <Redirect href="/(tabs)" />;
  }
}
