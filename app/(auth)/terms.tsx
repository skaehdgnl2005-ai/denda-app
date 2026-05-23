// 약관·개인정보 동의 모달 (V2_PRD §5.1).
//
// 첫 로그인 직후 노출. 필수 동의 2건 (이용약관 + 개인정보처리방침).
// 선택 동의 (마케팅 정보 수신)는 베타에서 노출하되 거부 가능.
// 동의 후 onboarding으로 진행.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { authStore } from '@/lib/auth/setup';

const TEXT_PRIMARY = 'rgba(0, 0, 0, 0.87)';
const TEXT_SECONDARY = 'rgba(0, 0, 0, 0.6)';
const CTA_DISABLED = 'rgba(0, 0, 0, 0.12)';
// brand-500 (D5) — S11에서 tokens.light.brand[500] 참조로 교체
const CTA_ENABLED = 'rgba(124, 58, 237, 1)';

type TermItem = {
  key: string;
  label: string;
  required: boolean;
};

const TERMS: TermItem[] = [
  { key: 'service', label: '이용약관 동의', required: true },
  { key: 'privacy', label: '개인정보 수집 및 이용 동의', required: true },
  { key: 'marketing', label: '마케팅 정보 수신 동의', required: false },
];

export default function TermsScreen() {
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

  const handleContinue = async () => {
    if (!allRequiredAgreed || submitting) {
      return;
    }
    setSubmitting(true);
    await authStore.getState().agreeToTerms();
    router.replace('/(auth)/onboarding');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 24,
          flexGrow: 1,
        }}
      >
        <Text
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: TEXT_PRIMARY,
            letterSpacing: -0.5,
          }}
        >
          시작하기 전에
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: TEXT_SECONDARY,
            marginTop: 8,
            lineHeight: 22,
          }}
        >
          {'서비스 이용을 위해\n다음 약관에 동의해주세요.'}
        </Text>

        <View style={{ marginTop: 32 }}>
          <Pressable
            onPress={toggleAll}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allChecked }}
            accessibilityLabel="모두 동의하기"
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              minHeight: 44,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <CheckBox checked={allChecked} />
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: TEXT_PRIMARY,
                marginLeft: 12,
              }}
            >
              모두 동의하기
            </Text>
          </Pressable>

          <View
            style={{
              height: 1,
              backgroundColor: 'rgba(0, 0, 0, 0.08)',
              marginVertical: 12,
            }}
          />

          {TERMS.map((term) => (
            <Pressable
              key={term.key}
              onPress={() => toggle(term.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: Boolean(agreed[term.key]) }}
              accessibilityLabel={term.label}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                minHeight: 44,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <CheckBox checked={Boolean(agreed[term.key])} />
              <Text
                style={{
                  fontSize: 15,
                  color: TEXT_PRIMARY,
                  marginLeft: 12,
                  flex: 1,
                }}
              >
                {term.required ? '[필수] ' : '[선택] '}
                {term.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={handleContinue}
          disabled={!allRequiredAgreed || submitting}
          accessibilityRole="button"
          accessibilityLabel="동의하고 계속"
          accessibilityState={{ disabled: !allRequiredAgreed || submitting }}
          style={({ pressed }) => ({
            backgroundColor: allRequiredAgreed ? CTA_ENABLED : CTA_DISABLED,
            opacity: pressed ? 0.9 : 1,
            minHeight: 52,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 24,
          })}
        >
          <Text
            style={{
              color: allRequiredAgreed ? 'white' : TEXT_SECONDARY,
              fontSize: 16,
              fontWeight: '600',
            }}
          >
            동의하고 계속
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 4,
        borderWidth: checked ? 0 : 1.5,
        borderColor: 'rgba(0, 0, 0, 0.3)',
        backgroundColor: checked ? CTA_ENABLED : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>✓</Text> : null}
    </View>
  );
}
