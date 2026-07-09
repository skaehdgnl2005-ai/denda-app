// S22 — 호스트 인앱 모임 초대 화면.
//
// Route: /group/[id]/invite
//
// 흐름:
//   1. friendsApi.list() → 친구 목록 fetch.
//   2. 친구 row tap → toggle (Set).
//   3. 하단 brand-500 fill CTA "N명 초대하기" tap → 선택된 ids 모두 createInvitation 일괄 호출.
//   4. 부분 실패 허용 (한 명 이미 초대 등) → 성공/실패 카운트를 결과 토스트로 surface + back.
//
// D31 정합: friends list 자체가 RLS is_blocked 통과 → 차단한/차단당한 사용자는 자연 hide.
// 친구가 이미 group_member 인 경우는 베타 단순화로 list 에 그대로 노출 → createInvitation 시
//   23505 dedup (이미 pending) 또는 RPC accept 시 ON CONFLICT DO NOTHING (멤버 idempotent).
//
// DESIGN 토큰 only · 한국어 only · §17 anti-AI-feel (brand-500 fill CTA = 단 1개 = "초대하기").

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { friendsApi, type FriendUser } from '@/lib/friends/api';
import { invitationsApi } from '@/lib/groups/invitations';
import { messages } from '@/lib/i18n/messages';

export default function GroupInviteScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const groupId = params.id ?? '';
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const toast = useToast();

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [inflight, setInflight] = useState(false);

  const loadFriends = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(false);
    try {
      const list = await friendsApi.list();
      setFriends(list);
    } catch {
      // 로드 실패를 raw 메시지로 노출하지 않고 EmptyState error로(W1-10).
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFriends();
  }, [loadFriends]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (inflight || selected.size === 0) return;
    setInflight(true);
    const ids = Array.from(selected);
    const results = await Promise.allSettled(
      ids.map((inviteeId) => invitationsApi.createInvitation({ groupId, inviteeId })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fail = results.length - ok;
    setInflight(false);
    if (fail === 0) {
      toast.show({ message: messages.success.invited(ok), variant: 'success' });
    } else if (ok === 0) {
      toast.show({
        message: '초대를 보내지 못했어요. 잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
    } else {
      toast.show({ message: `${ok}명 성공, ${fail}명은 보내지 못했어요.`, variant: 'error' });
    }
    router.back();
  }, [groupId, inflight, selected, router, toast]);

  const renderEmpty = (): React.JSX.Element => (
    <View
      style={[styles.centered, { paddingHorizontal: space[6], paddingVertical: space[8] }]}
      testID="invite-empty-state"
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: radius.full,
          backgroundColor: colors.brand[50],
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: space[4],
        }}
      >
        <Icon name="친구" color={colors.brand[500]} size={36} />
      </View>
      <Title level="h3" color={colors.text.primary} style={{ marginBottom: space[2] }}>
        초대할 친구가 없어요
      </Title>
      <Body
        variant="sm"
        color={colors.text.tertiary}
        style={{ textAlign: 'center', marginBottom: space[6] }}
      >
        먼저 친구를 추가하면{'\n'}모임에 함께 초대할 수 있어요.
      </Body>
      <Pressable
        onPress={() => router.push('/friends/search')}
        accessibilityRole="button"
        accessibilityLabel="친구 검색으로 이동"
        testID="invite-empty-search-cta"
        style={({ pressed }) => ({
          backgroundColor: colors.brand[50],
          borderColor: colors.brand[300],
          borderWidth: 1,
          borderRadius: radius.full,
          paddingHorizontal: space[5],
          paddingVertical: space[3],
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Body variant="sm-bold" color={colors.brand[500]}>
          친구 검색하기
        </Body>
      </Pressable>
    </View>
  );

  const renderFriendRow = ({ item }: { item: FriendUser }): React.JSX.Element => {
    const checked = selected.has(item.id);
    return (
      <Pressable
        onPress={() => toggle(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${item.nickname} 선택`}
        testID={`invite-friend-${item.id}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: checked ? colors.brand[50] : colors.surface[1],
          borderRadius: radius.md,
          padding: space[4],
          marginTop: space[2],
          borderWidth: 1,
          borderColor: checked ? colors.brand[300] : colors.border.subtle,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.surface[2],
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: space[3],
          }}
        >
          <Icon name="친구" color={colors.text.tertiary} size={20} />
        </View>
        <Body color={colors.text.primary} style={{ flex: 1 }} numberOfLines={1}>
          {item.nickname}
        </Body>
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.full,
            backgroundColor: checked ? colors.brand[500] : colors.surface[2],
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Icon name="확정" color={colors.text['on-brand']} size={16} /> : null}
        </View>
      </Pressable>
    );
  };

  const count = selected.size;
  const ctaDisabled = count === 0 || inflight;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <View style={[styles.topBar, { paddingHorizontal: space[4], paddingVertical: space[3] }]}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="뒤로 가기"
          testID="back-button"
          style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="뒤로" color={colors.text.primary} size={24} />
        </Pressable>
        <Title level="h2" color={colors.text.primary} style={styles.titleFlex}>
          친구 초대
        </Title>
        <View style={styles.iconButton} />
      </View>

      <View style={{ paddingHorizontal: space[4], paddingBottom: space[2] }}>
        <Caption color={colors.text.tertiary}>모임에 함께 시간을 맞출 친구를 골라주세요.</Caption>
      </View>

      {loading ? (
        <View style={{ paddingHorizontal: space[4], paddingTop: space[2] }} testID="invite-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={68} style={{ marginTop: space[2] }} />
          ))}
        </View>
      ) : error ? (
        <EmptyState
          variant="error"
          title="친구 목록을 불러오지 못했어요"
          body="잠시 후 다시 시도해볼게요."
          cta={{ label: messages.action.retry, onPress: loadFriends }}
          testID="invite-error"
        />
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingHorizontal: space[4],
            paddingBottom: space[6],
            flexGrow: 1,
          }}
          renderItem={renderFriendRow}
          ListEmptyComponent={renderEmpty}
          testID="invite-friends-list"
        />
      )}

      {friends.length > 0 ? (
        <View
          style={[
            styles.footer,
            {
              padding: space[4],
              borderTopColor: colors.border.subtle,
              backgroundColor: colors.surface[0],
            },
          ]}
        >
          <Pressable
            onPress={handleSubmit}
            disabled={ctaDisabled}
            accessibilityRole="button"
            accessibilityLabel={`${count}명 초대하기`}
            accessibilityState={{ disabled: ctaDisabled }}
            testID="invite-submit-button"
            style={({ pressed }) => ({
              backgroundColor: ctaDisabled ? colors.surface[2] : colors.brand[500],
              borderRadius: radius.md,
              paddingVertical: space[4],
              alignItems: 'center',
              opacity: pressed && !ctaDisabled ? 0.92 : 1,
            })}
          >
            <Body
              variant="bold"
              color={ctaDisabled ? colors.text.tertiary : colors.text['on-brand']}
            >
              {inflight
                ? '초대 보내는 중...'
                : count > 0
                  ? `${count}명 초대하기`
                  : '친구를 골라주세요'}
            </Body>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleFlex: { flex: 1, textAlign: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center' },
  footer: { borderTopWidth: 1 },
});
