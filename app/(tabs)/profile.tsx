// 프로필 탭 — 닉네임 + 로그아웃 (placeholder, S15 정식 UI는 후속).

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { ReauthModal } from '@/components/calendar/ReauthModal';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { authStore, useAuth } from '@/lib/auth/setup';
import { isGoogleReauthNeeded } from '@/lib/calendar/reauth';
import { createGoogleCalendarProvider, signInGoogleAndUpload } from '@/lib/calendar/setup';
import { supabase } from '@/lib/supabase/client';

export default function ProfileScreen() {
  const { colors, space, radius } = useTheme();
  const nickname = useAuth((s) => s.session?.user.nickname ?? '');
  const userId = useAuth((s) => s.session?.user.id);
  const [showReauth, setShowReauth] = useState(false);

  // S06: profile 진입 시 Google 재인증 필요 여부 체크. true면 ReauthModal 노출.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    isGoogleReauthNeeded(supabase, userId).then((needs) => {
      if (!cancelled && needs) setShowReauth(true);
    });
    return (): void => {
      cancelled = true;
    };
  }, [userId]);

  // S06: signInGoogle lazy 구성 — createGoogleCalendarProvider 호출 시점 expo-* dynamicRequire.
  const handleSignInGoogle = useCallback(async (): Promise<void> => {
    const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
    const { provider, storage } = createGoogleCalendarProvider({
      oauthConfig: { clientId, redirectUri: 'denda://oauth' },
    });
    await signInGoogleAndUpload({ provider, storage, supabase });
  }, []);

  const handleReauthSuccess = useCallback(async (): Promise<void> => {
    if (!userId) return;
    // Fail #9 wire-up: 영구 stall된 calendar_retry_count(>=3) row reset →
    // worker 다음 tick(1분)에서 자동 재시도. 실패는 silent (재인증 자체는 성공).
    try {
      await supabase.rpc('reset_my_stalled_calendar_retries');
    } catch {
      // silent
    }
    const needs = await isGoogleReauthNeeded(supabase, userId);
    if (!needs) setShowReauth(false);
  }, [userId]);

  const handleSignOut = async () => {
    await authStore.getState().signOut();
    router.replace('/');
  };

  const initial = nickname ? nickname.charAt(0) : '?';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <View
        style={{
          paddingHorizontal: space[4],
          paddingTop: space[4],
          paddingBottom: space[3],
        }}
      >
        <Title level="h1" color={colors.text.primary}>
          프로필
        </Title>
      </View>

      <View style={{ alignItems: 'center', paddingTop: space[6] }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: radius.full,
            backgroundColor: colors.surface[2],
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space[3],
          }}
        >
          <Title level="h1" color={colors.text.primary}>
            {initial}
          </Title>
        </View>
        <Body variant="bold" color={colors.text.primary}>
          {nickname || '게스트'}
        </Body>
        <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: 4 }}>
          카카오 로그인
        </Caption>
      </View>

      <View style={{ paddingHorizontal: space[4], marginTop: space[10] }}>
        <SettingRow
          icon="캘린더"
          label="에브리타임 시간표 가져오기"
          onPress={() => router.push('/schedule/everytime')}
          testID="everytime-import-link"
        />
        <SettingRow
          icon="알림 켜짐"
          label="알림 설정"
          onPress={() => Alert.alert('알림 설정', '준비 중이에요. 정식 출시 때 만나요.')}
          testID="notifications-row"
        />
        <SettingRow
          icon="신고"
          label="신고·차단 관리"
          onPress={() =>
            Alert.alert(
              '신고·차단 관리',
              '준비 중이에요. 지금은 친구 카드에서 신고·차단할 수 있어요.',
            )
          }
          testID="reports-row"
        />
        <SettingRow
          icon="다크/라이트"
          label="화면 모드"
          onPress={() => Alert.alert('화면 모드', '기기 설정의 다크 모드를 따라요.')}
          testID="theme-row"
        />
      </View>

      <View style={{ flex: 1 }} />

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[6] }}>
        <Pressable
          onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="로그아웃"
          style={({ pressed }) => ({
            paddingVertical: space[3],
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
          testID="signout-button"
        >
          <Caption variant="default" color={colors.text.tertiary}>
            로그아웃
          </Caption>
        </Pressable>
      </View>

      <ReauthModal
        visible={showReauth}
        onClose={() => setShowReauth(false)}
        signInGoogle={handleSignInGoogle}
        onSuccess={handleReauthSuccess}
      />
    </SafeAreaView>
  );
}

function SettingRow({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: '알림 켜짐' | '신고' | '다크/라이트' | '캘린더';
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors, space, radius } = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: space[3],
        paddingHorizontal: space[3],
        borderRadius: radius.md,
        backgroundColor: colors.surface[2],
      }}
    >
      <Icon name={icon as never} color={colors.text.secondary} size={20} />
      <Body variant="primary" color={colors.text.primary} style={{ flex: 1, marginLeft: space[3] }}>
        {label}
      </Body>
      <Icon name="화살표" color={colors.text.tertiary} size={18} />
    </View>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        style={({ pressed }) => ({ marginBottom: space[2], opacity: pressed ? 0.7 : 1 })}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={{ marginBottom: space[2] }}>{content}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
