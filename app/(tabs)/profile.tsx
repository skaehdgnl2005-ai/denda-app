// 프로필 탭 — 프로필 카드 + 섹션 구분 설정 + 로그아웃.
// §17.3 위계: 닉네임(title) → 출처(caption). §17.5/§17.6: "준비 중" 행은 pill로 명시해
// 사용자가 누르기 전에 상태를 알 수 있게 한다(빈 Alert 서프라이즈 방지).
// D5 절제: 보라 fill 0개. 로그아웃은 회색 bordered 행. 한국어 only · 토큰만.

import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { ReauthModal } from '@/components/calendar/ReauthModal';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { authStore, useAuth } from '@/lib/auth/setup';
import { deleteAccount } from '@/lib/auth/deleteAccount';
import { isGoogleReauthNeeded } from '@/lib/calendar/reauth';
import {
  clearStoredGoogleToken,
  createGoogleCalendarProvider,
  signInGoogleAndUpload,
} from '@/lib/calendar/setup';
import { supabase } from '@/lib/supabase/client';

const APP_VERSION = '베타 v0.1.0';

export default function ProfileScreen() {
  const { colors, space, radius } = useTheme();
  const nickname = useAuth((s) => s.session?.user.nickname ?? '');
  const userId = useAuth((s) => s.session?.user.id);
  const [showReauth, setShowReauth] = useState(false);
  // S06/W2-11: 캘린더 연결 끊김 여부를 영구 보관 → 프로필에 상시 재연결 행 노출.
  const [calendarDisconnected, setCalendarDisconnected] = useState(false);
  const toast = useToast();
  const [deleteStep, setDeleteStep] = useState<null | 'warn' | 'confirm'>(null);
  const [deleting, setDeleting] = useState(false);

  // S06: profile 진입 시 Google 재인증 필요 여부 체크. true면 ReauthModal 노출.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    isGoogleReauthNeeded(supabase, userId).then((needs) => {
      if (cancelled) return;
      // 끊김 상태 persist(상시 행) + 마운트 시 auto-open 유지.
      setCalendarDisconnected(needs);
      if (needs) setShowReauth(true);
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
    setCalendarDisconnected(needs);
    if (!needs) setShowReauth(false);
  }, [userId]);

  const handleSignOut = async () => {
    await authStore.getState().signOut();
    router.replace('/');
  };

  // 2단 확인의 마지막 단계 — 실제 탈퇴. 성공 시 로컬 세션·기기 플래그까지 teardown 후 스플래시로.
  const handleConfirmDelete = useCallback(async (): Promise<void> => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (e) {
      setDeleting(false);
      setDeleteStep(null);
      toast.show({
        message:
          e instanceof Error ? e.message : '회원 탈퇴에 실패했어요. 잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
      return;
    }
    // 서버 삭제 성공(되돌릴 수 없음) — 로컬 세션·기기 자격증명(약관·온보딩 플래그 + Google 토큰)을
    // 정리한 뒤 스플래시로. 로컬 정리가 실패해도(키체인 잠금 등) 계정은 이미 삭제됐으므로,
    // 무한 로딩에 갇히지 않도록 반드시 화면을 벗어난다.
    try {
      await authStore.getState().resetForAccountDeletion();
      await clearStoredGoogleToken();
    } catch {
      // best-effort
    }
    router.replace('/');
  }, [toast]);

  const initial = nickname ? nickname.charAt(0) : '?';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]} edges={['top']}>
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

      <ScrollView
        contentContainerStyle={{ paddingBottom: space[8] }}
        showsVerticalScrollIndicator={false}
      >
        {/* 프로필 카드 */}
        <View style={{ alignItems: 'center', paddingTop: space[4] }}>
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
          <Title level="h3" color={colors.text.primary}>
            {nickname || '게스트'}
          </Title>
          <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: space[1] }}>
            카카오 로그인
          </Caption>
        </View>

        {/* 내 일정 */}
        <Section title="내 일정">
          {/* 캘린더 연결 상태 — 끊겼을 때만 상시 error 행으로 재연결(나중에 닫아도 재진입).
              isGoogleReauthNeeded=false는 연결됨·미사용·전송오류를 구분 못 하므로 "연결됨"을
              단정하지 않는다(리뷰 confirmed — Apple-only/미연결 사용자 오표기 방지). */}
          {calendarDisconnected ? (
            <SettingRow
              icon="캘린더"
              label="Google 캘린더 연결이 끊겼어요"
              status="error"
              onPress={() => setShowReauth(true)}
              testID="calendar-connection-row"
            />
          ) : null}
          <SettingRow
            icon="캘린더"
            label="에브리타임 시간표 가져오기"
            onPress={() => router.push('/schedule/everytime')}
            testID="everytime-import-link"
          />
        </Section>

        {/* 설정 — 준비 중/정보 행은 비대화형(§17.5 pill·hint로 상태 명시, 죽은 Alert 제거) */}
        <Section title="설정">
          {/* 표시되는 닉네임은 public.users 값 — authStore가 로그인·콜드 스타트에 반영한다.
              카카오 클레임 캐시가 아니므로 여기서 바꾼 값이 친구 검색 결과와 일치한다. */}
          <SettingRow
            icon="프로필"
            label="닉네임 변경"
            hint={nickname || undefined}
            onPress={() => router.push('/(auth)/nickname')}
            testID="nickname-row"
          />
          <SettingRow icon="알림 켜짐" label="알림 설정" pending testID="notifications-row" />
          <SettingRow
            icon="다크/라이트"
            label="화면 모드"
            hint="기기 설정 따름"
            testID="theme-row"
          />
        </Section>

        {/* 약관·정보 — read-only 전문 화면으로 이동(약관 GATE인 terms.tsx로는 라우팅하지 않음) */}
        <Section title="약관·정보">
          <SettingRow
            icon="안내"
            label="이용약관"
            onPress={() => router.push({ pathname: '/(auth)/legal', params: { doc: 'service' } })}
            testID="terms-of-service-link"
          />
          <SettingRow
            icon="안내"
            label="개인정보 처리방침"
            onPress={() => router.push('/(auth)/privacy')}
            testID="privacy-policy-link"
          />
        </Section>

        {/* 관리 */}
        <Section title="관리">
          <SettingRow icon="신고" label="신고·차단 관리" pending testID="reports-row" />
          <SettingRow
            icon="삭제"
            label="회원 탈퇴"
            danger
            onPress={() => setDeleteStep('warn')}
            testID="delete-account-button"
          />
        </Section>

        {/* 로그아웃 — 회색 bordered (D5 절제: 보라 아님) */}
        <View style={{ paddingHorizontal: space[4], marginTop: space[10] }}>
          <Pressable
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="로그아웃"
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: colors.border.subtle,
              borderRadius: radius.md,
              paddingVertical: space[3],
              alignItems: 'center',
              backgroundColor: pressed ? colors.surface[2] : colors.surface[0],
            })}
            testID="signout-button"
          >
            <Body variant="sm-bold" color={colors.text.secondary}>
              로그아웃
            </Body>
          </Pressable>
        </View>

        {/* 버전 */}
        <Caption
          variant="micro"
          color={colors.text.disabled}
          style={{ textAlign: 'center', marginTop: space[6] }}
        >
          된다 · {APP_VERSION}
        </Caption>
      </ScrollView>

      <ReauthModal
        visible={showReauth}
        onClose={() => setShowReauth(false)}
        signInGoogle={handleSignInGoogle}
        onSuccess={handleReauthSuccess}
      />

      {/* W1-14 회원 탈퇴 — 2단 확인(경고 → 마지막 확인). destructive + 진행 중 dismiss 차단. */}
      <ConfirmSheet
        visible={deleteStep !== null}
        onClose={() => setDeleteStep(null)}
        destructive
        loading={deleting}
        title={deleteStep === 'confirm' ? '마지막 확인이에요' : '정말 탈퇴하시겠어요?'}
        message={
          deleteStep === 'confirm'
            ? '이 작업은 되돌릴 수 없어요. 지금 탈퇴할까요?'
            : '회원님이 만든 모임과 그 안의 투표·댓글·초대가 모두 사라져요. 되돌릴 수 없어요.'
        }
        confirmLabel={deleteStep === 'confirm' ? '탈퇴하기' : '탈퇴 계속하기'}
        cancelLabel={deleteStep === 'confirm' ? '아니요' : '취소'}
        onConfirm={deleteStep === 'confirm' ? handleConfirmDelete : () => setDeleteStep('confirm')}
        testID="delete-account-sheet"
      />
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ paddingHorizontal: space[4], marginTop: space[6] }}>
      <Caption
        variant="micro"
        color={colors.text.tertiary}
        style={{ marginBottom: space[2], marginLeft: space[1] }}
      >
        {title}
      </Caption>
      {children}
    </View>
  );
}

function SettingRow({
  icon,
  label,
  onPress,
  testID,
  pending,
  hint,
  danger,
  status,
}: {
  icon: IconName;
  label: string;
  onPress?: () => void;
  testID?: string;
  pending?: boolean;
  hint?: string;
  /** 파괴적 액션(회원 탈퇴 등) — error 색·chevron 없음 (§10.6, D5 절제) */
  danger?: boolean;
  /** 'error' = 조치 필요 상태(캘린더 연결 끊김 등) — error 색 + 경고 아이콘·"연결 끊김"
   *  뱃지로 색 단독 의존 회피(§12.6). danger와 달리 눌러서 조치 가능(chevron 유지). */
  status?: 'error';
}) {
  const { colors, space, radius } = useTheme();
  const isError = status === 'error';
  const accent = danger || isError ? colors.semantic.error.fg : undefined;
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
      <Icon name={icon} color={accent ?? colors.text.secondary} size={20} />
      <Body
        variant="primary"
        color={accent ?? colors.text.primary}
        style={{ flex: 1, marginLeft: space[3] }}
      >
        {label}
      </Body>
      {isError ? (
        <View
          testID="calendar-disconnected-badge"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginRight: space[2],
          }}
        >
          <Icon name="경고" color={colors.semantic.error.fg} size={16} />
          <Caption
            variant="micro"
            color={colors.semantic.error.fg}
            style={{ marginLeft: space[1] }}
          >
            연결 끊김
          </Caption>
        </View>
      ) : pending ? (
        <View
          style={{
            backgroundColor: colors.surface[3],
            borderRadius: radius.pill,
            paddingHorizontal: space[2],
            paddingVertical: 2,
            marginRight: space[2],
          }}
        >
          <Caption variant="micro" color={colors.text.tertiary}>
            준비 중
          </Caption>
        </View>
      ) : hint ? (
        <Caption variant="micro" color={colors.text.tertiary} style={{ marginRight: space[2] }}>
          {hint}
        </Caption>
      ) : null}
      {/* chevron은 이동 어포던스 — 비대화형 행·파괴적 액션엔 표시하지 않는다 */}
      {onPress && !danger ? <Icon name="화살표" color={colors.text.tertiary} size={18} /> : null}
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
  return (
    <View testID={testID} style={{ marginBottom: space[2] }}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
