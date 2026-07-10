// W1-13 — 약관 전문 화면 (이용약관 / 마케팅 정보 수신).
//
// terms.tsx의 각 약관 행 chevron에서 doc 파라미터로 진입하는 읽기 전용 전문 화면.
// 개인정보 처리방침은 별도 PIPA 화면(privacy.tsx)이 담당하고, 본 화면은 이용약관·마케팅을 렌더한다.
// privacy.tsx의 Section/SubHeading/Bullet 패턴을 재사용 — 법무 검토 전 1차안.

import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';

type LegalDoc = 'service' | 'marketing';

function resolveDoc(raw: string | undefined): LegalDoc {
  return raw === 'marketing' ? 'marketing' : 'service';
}

const DOC_TITLE: Record<LegalDoc, string> = {
  service: '이용약관',
  marketing: '마케팅 정보 수신 동의',
};

export default function LegalScreen() {
  const { colors, space } = useTheme();
  const params = useLocalSearchParams<{ doc?: string }>();
  const doc = resolveDoc(params.doc);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <ScreenHeader title={DOC_TITLE[doc]} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingTop: space[5],
          paddingBottom: space[6],
        }}
        accessibilityLabel={`${DOC_TITLE[doc]} 전문`}
      >
        <Caption variant="default" color={colors.text.tertiary}>
          시행일: 2026-05-29 (1차안 · 정식 출시 전 법무 검토 예정)
        </Caption>

        {doc === 'service' ? <ServiceTerms /> : <MarketingTerms />}
      </ScrollView>
    </SafeAreaView>
  );
}

function ServiceTerms() {
  const { colors, space } = useTheme();
  return (
    <>
      <Body
        variant="primary"
        color={colors.text.secondary}
        style={{ marginTop: space[3], lineHeight: 22 }}
      >
        본 약관은 된다(이하 &ldquo;회사&rdquo;)가 제공하는 모임 일정·장소 조율 서비스(이하
        &ldquo;서비스&rdquo;)의 이용과 관련해 회사와 이용자의 권리·의무 및 책임 사항을 규정합니다.
      </Body>

      <Section title="제1조 (목적)" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          이 약관은 이용자가 서비스를 이용함에 있어 회사와 이용자 간의 권리·의무 및 책임 사항, 이용
          조건과 절차 등 기본적인 사항을 정함을 목적으로 합니다.
        </Body>
      </Section>

      <Section title="제2조 (정의)" colors={colors} space={space}>
        <Bullet
          text="'서비스'란 회사가 제공하는 모임 시간 투표, 장소 조율, 초대·친구 기능 일체를 말합니다."
          colors={colors}
          space={space}
        />
        <Bullet
          text="'이용자'란 본 약관에 동의하고 서비스를 이용하는 회원을 말합니다."
          colors={colors}
          space={space}
        />
        <Bullet
          text="'모임'이란 이용자가 생성하거나 참여하는 일정 조율 단위를 말합니다."
          colors={colors}
          space={space}
        />
      </Section>

      <Section title="제3조 (약관의 효력 및 변경)" colors={colors} space={space}>
        <Bullet
          text="본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다."
          colors={colors}
          space={space}
        />
        <Bullet
          text="회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일과 사유를 사전에 공지합니다."
          colors={colors}
          space={space}
        />
      </Section>

      <Section title="제4조 (서비스의 제공 및 변경)" colors={colors} space={space}>
        <Bullet
          text="회사는 안정적인 서비스 제공을 위해 노력하며, 운영상·기술상 필요 시 서비스의 전부 또는 일부를 변경할 수 있습니다."
          colors={colors}
          space={space}
        />
        <Bullet
          text="서비스 점검·교체 등 정당한 사유가 있는 경우 일시 중단될 수 있으며, 이 경우 사전 공지를 원칙으로 합니다."
          colors={colors}
          space={space}
        />
      </Section>

      <Section title="제5조 (이용자의 의무)" colors={colors} space={space}>
        <Bullet
          text="타인의 정보를 도용하거나 허위로 등록하지 않습니다."
          colors={colors}
          space={space}
        />
        <Bullet
          text="서비스를 이용해 법령·공서양속에 반하는 행위를 하지 않습니다."
          colors={colors}
          space={space}
        />
        <Bullet
          text="다른 이용자를 괴롭히거나 모임 운영을 방해하지 않습니다."
          colors={colors}
          space={space}
        />
      </Section>

      <Section title="제6조 (서비스 이용 제한)" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          이용자가 본 약관 또는 관련 법령을 위반하는 경우, 회사는 사전 통지 후 서비스 이용을
          제한하거나 이용 계약을 해지할 수 있습니다. 긴급한 경우 통지 없이 제한 후 사후 안내할 수
          있습니다.
        </Body>
      </Section>

      <Section title="제7조 (책임의 한계)" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          회사는 천재지변, 이용자 귀책, 제3자 서비스 장애 등 회사의 통제를 벗어난 사유로 발생한
          손해에 대해서는 관련 법령이 허용하는 범위에서 책임을 지지 않습니다.
        </Body>
      </Section>

      <Section title="제8조 (준거법 및 관할)" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련한 분쟁은 관계 법령이 정한
          절차에 따릅니다.
        </Body>
      </Section>

      <Caption
        variant="default"
        color={colors.text.tertiary}
        style={{ marginTop: space[6], lineHeight: 18 }}
      >
        본 약관은 2026-05-29부터 적용됩니다. 정식 출시 시점에 법무 검토 결과를 반영해 갱신될 수
        있으며, 중요 변경 사항은 앱 내 공지로 알려드립니다. 문의: cs@denda.app
      </Caption>
    </>
  );
}

function MarketingTerms() {
  const { colors, space } = useTheme();
  return (
    <>
      <Body
        variant="primary"
        color={colors.text.secondary}
        style={{ marginTop: space[3], lineHeight: 22 }}
      >
        마케팅 정보 수신은 선택 항목이며, 동의하지 않아도 서비스 이용에 제한이 없습니다. 아래 내용을
        확인하신 뒤 동의 여부를 선택해 주세요.
      </Body>

      <Section title="1. 수신 항목" colors={colors} space={space}>
        <Bullet text="신규 기능·업데이트 안내" colors={colors} space={space} />
        <Bullet text="이벤트·혜택·프로모션 소식" colors={colors} space={space} />
        <Bullet text="이용 팁 및 맞춤 추천" colors={colors} space={space} />
      </Section>

      <Section title="2. 수신 방법" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          앱 푸시 알림으로 발송됩니다. 별도의 광고성 이메일·문자는 발송하지 않으며, 발송 시각은 관련
          법령에 따라 야간 시간대를 피합니다.
        </Body>
      </Section>

      <Section title="3. 동의 철회" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          마케팅 정보 수신 동의는 언제든지 철회할 수 있습니다. 프로필 &gt; 알림 설정에서 직접
          해제하거나 cs@denda.app으로 요청하시면 지체 없이 처리합니다. 철회 후에도 모임 관련 필수
          안내(예: 모임 확정 알림)는 계속 발송됩니다.
        </Body>
      </Section>

      <Section title="4. 유의 사항" colors={colors} space={space}>
        <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
          본 동의는 선택 사항으로, 동의하지 않아도 회원가입 및 서비스 이용에 아무런 불이익이
          없습니다.
        </Body>
      </Section>

      <Caption
        variant="default"
        color={colors.text.tertiary}
        style={{ marginTop: space[6], lineHeight: 18 }}
      >
        본 안내는 2026-05-29부터 적용됩니다. 정식 출시 시점에 법무 검토 결과를 반영해 갱신될 수
        있습니다. 문의: cs@denda.app
      </Caption>
    </>
  );
}

function Section({
  title,
  children,
  colors,
  space,
}: {
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useTheme>['colors'];
  space: ReturnType<typeof useTheme>['space'];
}) {
  return (
    <View style={{ marginTop: space[6] }}>
      <Title level="h3" color={colors.text.primary}>
        {title}
      </Title>
      <View style={{ marginTop: space[2] }}>{children}</View>
    </View>
  );
}

function Bullet({
  text,
  colors,
  space,
}: {
  text: string;
  colors: ReturnType<typeof useTheme>['colors'];
  space: ReturnType<typeof useTheme>['space'];
}) {
  return (
    <View style={{ flexDirection: 'row', marginTop: space[1], paddingLeft: space[2] }}>
      <Body variant="primary" color={colors.text.secondary} style={{ marginRight: space[2] }}>
        ·
      </Body>
      <Body variant="primary" color={colors.text.secondary} style={{ flex: 1, lineHeight: 22 }}>
        {text}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
