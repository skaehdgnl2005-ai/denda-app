// S18 — 모임 생성 화면. 이름 + 후보 날짜 다중선택(최대 7일) → createGroup → 그리드 진입.
// 날짜 선택은 칩 나열 대신 월간 캘린더(CalendarDatePicker) — 사용자가 요일·주 구조를 보고 고른다.
// §17 anti-AI-feel: brand-500 fill CTA 1개(만들기). KST(luxon, todayKstIso). 한국어 only.
import React, { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { CalendarDatePicker } from '@/components/calendar/CalendarDatePicker';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useToast } from '@/components/Toast';
import { ctaPressBg } from '@/design/press';
import { useTheme } from '@/design/theme';
import { Body, Caption } from '@/design/typography';
import { createGroup } from '@/lib/groups/create';
import { todayKstIso } from '@/lib/groups/dateOptions';
import { mapError } from '@/lib/i18n/messages';

const MAX_DATES = 7; // 그리드 7열 정합

export default function NewGroupScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const toast = useToast();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inflight, setInflight] = useState(false);

  const today = useMemo(() => todayKstIso(), []);
  const canSubmit = name.trim().length > 0 && selected.size > 0 && !inflight;
  const lastMaxToastRef = useRef(0);

  const toggleDate = (iso: string): void => {
    // 최대치에서 "새 날짜"를 추가하려는 거부만 안내 (해제는 조용히 통과).
    if (!selected.has(iso) && selected.size >= MAX_DATES) {
      const now = Date.now();
      if (now - lastMaxToastRef.current > 1500) {
        lastMaxToastRef.current = now;
        toast.show({ message: `최대 ${MAX_DATES}일까지 골라요`, variant: 'default' });
      }
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setInflight(true);
    try {
      const dates = [...selected].sort();
      const { id } = await createGroup({ name, dates });
      router.replace(`/group/${id}`);
    } catch (e) {
      const { silent, message } = mapError(e);
      if (!silent) toast.show({ message, variant: 'error' });
    } finally {
      setInflight(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <ScreenHeader title="새 모임" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[8] }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Caption
            color={colors.text.tertiary}
            style={{ marginTop: space[2], marginBottom: space[2] }}
          >
            모임 이름
          </Caption>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="예: 5/30 저녁 모임"
            placeholderTextColor={colors.text.disabled}
            testID="group-name-input"
            accessibilityLabel="모임 이름"
            maxLength={40}
            style={{
              backgroundColor: colors.surface[2],
              borderRadius: radius.md,
              paddingHorizontal: space[4],
              paddingVertical: space[3],
              color: colors.text.primary,
              fontFamily: 'PretendardVariable',
              fontSize: 16,
            }}
          />

          <Caption
            color={colors.text.tertiary}
            style={{ marginTop: space[6], marginBottom: space[3] }}
          >
            후보 날짜
          </Caption>
          <CalendarDatePicker
            selected={selected}
            onToggle={toggleDate}
            todayIso={today}
            maxSelectable={MAX_DATES}
            testID="date-calendar"
          />
        </ScrollView>

        <View style={[styles.footer, { padding: space[4], borderTopColor: colors.border.subtle }]}>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="모임 만들기"
            accessibilityState={{ disabled: !canSubmit }}
            testID="create-group-submit"
            style={({ pressed }) => ({
              backgroundColor: canSubmit ? ctaPressBg(pressed, colors) : colors.surface[3],
              borderRadius: radius.md,
              paddingVertical: space[4],
              alignItems: 'center',
            })}
          >
            <Body variant="bold" color={canSubmit ? colors.text['on-brand'] : colors.text.disabled}>
              {inflight ? '만드는 중...' : '모임 만들기'}
            </Body>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  footer: { borderTopWidth: 1 },
});
