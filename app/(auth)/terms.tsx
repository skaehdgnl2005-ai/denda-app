// 약관 동의 — §17.1·17.5 적용:
//   - "모두 동의하기"는 강조 카드 (brand-50 hint background)
//   - 개별 약관은 카드 리스트
//   - disabled CTA는 brand-200 (회색 X) + hint 텍스트

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';
import { authStore } from '@/lib/auth/setup';

type TermItem = {
  key: string;
  label: string;
  required: boolean;
};

const TERMS: TermItem[] = [
  { key: 'service', label: '이용약관', required: true },
  { key: 'privacy', label: '개인정보 수집 및 이용', required: true },
  { key: 'marketing', label: '마케팅 정보 수신', required: false },
];

export default function TermsScreen() {
  const { colors, space, radius } = useTheme();
  const [agreed, setAgreed] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const allRequiredAgreed = useMemo(
    () => TERMS.filter((t) => t.required).every((t) => agreed[t.key]),
    [agreed],
  );
  const allChecked = useMemo(() => TERMS.every((t) => agreed[t.key]), [agreed]);

  const toggleAll = () => {
    if (allChecked) {
      setAgreed({});
    } else {
      const next: Record<string, boolean> = {};
      for (const t of TERMS) {
        next[t.key] = true;
      }
      setAgreed(next);
    }
  };

  const toggle = (key: string) => {
    setAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // W1-13 — chevron은 토글이 아니라 약관 전문 화면으로 이동한다 (법적 열람 의무).
  // 개인정보는 기존 PIPA 전문(privacy.tsx), 나머지는 legal 화면(doc 파라미터).
  const openDetail = (key: string) => {
    if (key === 'privacy') {
      router.push('/(auth)/privacy');
      return;
    }
    router.push({ pathname: '/(auth)/legal', params: { doc: key } });
  };

  const handleContinue = async () => {
    if (!allRequiredAgreed || submitting) {
      return;
    }
    setSubmitting(true);
    await authStore.getState().agreeToTerms();
    router.replace('/(auth)/onboarding');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingTop: space[6],
          paddingBottom: space[6],
          flexGrow: 1,
        }}
      >
        <Title level="h1" color={colors.text.primary} style={{ marginTop: space[3] }}>
          시작하기 전에
        </Title>
        <Body
          variant="primary"
          color={colors.text.secondary}
          style={{ marginTop: space[2], lineHeight: 24 }}
        >
          서비스 이용을 위해{'\n'}다음 약관에 동의해주세요.
        </Body>

        {/* 모두 동의 - 강조 카드 */}
        <Pressable
          onPress={toggleAll}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allChecked }}
          accessibilityLabel="모두 동의하기"
          style={({ pressed }) => [
            styles.allCard,
            {
              backgroundColor: allChecked ? colors.brand[50] : colors.surface[2],
              borderColor: allChecked ? colors.brand[300] : colors.border.subtle,
              borderRadius: radius.lg,
              paddingHorizontal: space[4],
              paddingVertical: space[4],
              marginTop: space[8],
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <CheckCircle checked={allChecked} />
          <View style={{ marginLeft: space[3], flex: 1 }}>
            <Body variant="bold" color={colors.text.primary}>
              모두 동의하기
            </Body>
            <Caption variant="default" color={colors.text.tertiary} style={{ marginTop: 2 }}>
              필수와 선택 항목을 한 번에 체크해요.
            </Caption>
          </View>
        </Pressable>

        {/* 개별 약관 카드 리스트 — 행 탭=토글, chevron=전문 화면 (44pt 별도 Pressable) */}
        <View style={{ marginTop: space[3] }}>
          {TERMS.map((term) => (
            <View
              key={term.key}
              style={[styles.termRow, { paddingLeft: space[4], borderRadius: radius.md }]}
            >
              <Pressable
                onPress={() => toggle(term.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(agreed[term.key]) }}
                accessibilityLabel={`${term.required ? '필수' : '선택'} ${term.label} 동의`}
                style={({ pressed }) => [
                  styles.toggleArea,
                  { paddingVertical: space[3], opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <CheckCircle checked={Boolean(agreed[term.key])} small />
                <View style={{ marginLeft: space[3], flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Body
                      variant="sm-bold"
                      color={term.required ? colors.brand[500] : colors.text.tertiary}
                      style={{ marginRight: space[2] }}
                    >
                      {term.required ? '필수' : '선택'}
                    </Body>
                    <Body variant="primary" color={colors.text.primary} style={{ flex: 1 }}>
                      {term.label}
                    </Body>
                  </View>
                </View>
              </Pressable>
              <Pressable
                onPress={() => openDetail(term.key)}
                accessibilityRole="link"
                accessibilityLabel={`${term.label} 전문 보기`}
                hitSlop={8}
                style={({ pressed }) => [styles.chevronButton, { opacity: pressed ? 0.5 : 1 }]}
              >
                <Icon name="화살표" color={colors.text.tertiary} size={18} />
              </Pressable>
            </View>
          ))}
        </View>

        {/* 전문 보기 링크 — PIPA 의무 (A-6) */}
        <Pressable
          onPress={() => router.push('/(auth)/privacy')}
          accessibilityRole="link"
          accessibilityLabel="개인정보 처리방침 전문 보기"
          hitSlop={8}
          style={({ pressed }) => ({
            alignSelf: 'flex-start',
            marginTop: space[5],
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ textDecorationLine: 'underline' }}
          >
            개인정보 처리방침 전문 보기
          </Caption>
        </Pressable>

        <View style={{ flex: 1 }} />
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingHorizontal: space[4],
            paddingTop: space[3],
            paddingBottom: space[5],
            borderTopColor: colors.border.subtle,
            backgroundColor: colors.surface[0],
          },
        ]}
      >
        {!allRequiredAgreed ? (
          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ textAlign: 'center', marginBottom: space[2] }}
          >
            필수 약관에 동의하면 시작할 수 있어요.
          </Caption>
        ) : null}
        <Pressable
          onPress={handleContinue}
          disabled={!allRequiredAgreed || submitting}
          accessibilityRole="button"
          accessibilityLabel="동의하고 계속"
          accessibilityState={{ disabled: !allRequiredAgreed || submitting }}
          style={({ pressed }) => [
            styles.ctaButton,
            {
              // §17.5 (revised): disabled = dead 회색. 활성만 brand.
              backgroundColor: allRequiredAgreed ? colors.brand[500] : colors.surface[2],
              opacity: pressed && allRequiredAgreed ? 0.92 : 1,
              borderRadius: radius.md,
            },
          ]}
        >
          <Body
            variant="bold"
            color={allRequiredAgreed ? colors.text['on-brand'] : colors.text.tertiary}
          >
            동의하고 계속
          </Body>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function CheckCircle({ checked, small = false }: { checked: boolean; small?: boolean }) {
  const { colors } = useTheme();
  const size = small ? 22 : 26;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: checked ? 0 : 1.5,
        borderColor: colors.border.strong,
        backgroundColor: checked ? colors.brand[500] : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Icon name="확정" color={colors.text['on-brand']} size={small ? 14 : 16} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  allCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  termRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  toggleArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chevronButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    borderTopWidth: 1,
  },
  ctaButton: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
