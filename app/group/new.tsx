// S18 — 모임 생성 화면. 이름 + 후보 날짜 다중선택(최대 7일) → createGroup → 그리드 진입.
// §17 anti-AI-feel: brand-500 fill CTA 1개(만들기). KST(luxon, dateOptions). 한국어 only.
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { createGroup } from '@/lib/groups/create';
import { buildDateOptions, formatDateChip, todayKstIso } from '@/lib/groups/dateOptions';

const MAX_DATES = 7; // 그리드 7열 정합
const DATE_WINDOW = 14; // 오늘부터 14일 후보

export default function NewGroupScreen(): React.JSX.Element {
  const router = useRouter();
  const { colors, space, radius } = useTheme();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inflight, setInflight] = useState(false);

  const options = useMemo(() => buildDateOptions(todayKstIso(), DATE_WINDOW), []);
  const canSubmit = name.trim().length > 0 && selected.size > 0 && !inflight;

  const toggleDate = (iso: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else if (next.size < MAX_DATES) {
        next.add(iso);
      }
      return next;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) return;
    setInflight(true);
    try {
      const dates = options.filter((d) => selected.has(d));
      const { id } = await createGroup({ name, dates });
      router.replace(`/group/${id}`);
    } catch (e) {
      Alert.alert('알림', (e as Error).message);
    } finally {
      setInflight(false);
    }
  };

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
          새 모임
        </Title>
        <View style={styles.iconButton} />
      </View>

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
          style={{ marginTop: space[6], marginBottom: space[2] }}
        >
          후보 날짜 (최대 {MAX_DATES}일)
        </Caption>
        <View style={styles.chips}>
          {options.map((iso, i) => {
            const active = selected.has(iso);
            return (
              <Pressable
                key={iso}
                onPress={() => toggleDate(iso)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`${formatDateChip(iso)}${active ? ' 선택됨' : ''}`}
                accessibilityState={{ selected: active }}
                testID={`date-chip-${i}`}
                style={{
                  paddingHorizontal: space[3],
                  paddingVertical: space[2],
                  borderRadius: radius.md,
                  marginRight: space[2],
                  marginBottom: space[2],
                  backgroundColor: active ? colors.brand[50] : colors.surface[2],
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.brand[500] : colors.border.subtle,
                }}
              >
                <Body
                  variant={active ? 'bold' : 'primary'}
                  color={active ? colors.brand[600] : colors.text.secondary}
                  tabularNums
                >
                  {formatDateChip(iso)}
                </Body>
              </Pressable>
            );
          })}
        </View>
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
            backgroundColor: canSubmit ? colors.brand[500] : colors.surface[3],
            borderRadius: radius.lg,
            paddingVertical: space[4],
            alignItems: 'center',
            opacity: pressed && canSubmit ? 0.92 : 1,
          })}
        >
          <Body variant="bold" color={canSubmit ? colors.text['on-brand'] : colors.text.disabled}>
            {inflight ? '만드는 중...' : '모임 만들기'}
          </Body>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titleFlex: { flex: 1, textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  footer: { borderTopWidth: 1 },
});
