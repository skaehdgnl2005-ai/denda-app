// PIPA 처리방침 화면 — D28 자체 deferred deep link + Apple ATT 의무 대응.
//
// 본 화면은 약관 동의 이전에 *읽기 전용*으로 열람 가능. terms.tsx에서 "전문 보기" 링크로 진입.
// 법무 검토 전 1차안 — founder review 후 cs@denda.app 연락처·시행일 확정 시 본 파일에 갱신.
//
// 핵심 PIPA 항목:
//   1. 수집 항목 (카카오 식별자 + 닉네임 + 모임 데이터 + IP/UA 해시)
//   2. 이용 목적 (회원 식별·일정 조율·푸시·초대 매칭·신고 처리)
//   3. 보유 기간 (탈퇴 시까지 / 초대 해시는 24시간)
//   4. 위탁 (Supabase·Expo·Naver·Google·Apple)
//   5. 사용자 권리 (열람·정정·삭제·동의 철회)
//   6. iOS ATT 안내 (거부해도 서비스 이용 무제한)

import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ScreenHeader';
import { useTheme } from '@/design/theme';
import { Body, Caption, Title } from '@/design/typography';

export default function PrivacyScreen() {
  const { colors, space, radius } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.surface[0] }]}>
      <ScreenHeader title="개인정보 처리방침" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space[4],
          paddingTop: space[5],
          paddingBottom: space[6],
        }}
        accessibilityLabel="개인정보 처리방침 전문"
      >
        <Caption variant="default" color={colors.text.tertiary}>
          시행일: 2026-05-29 (1차안 · 정식 출시 전 법무 검토 예정)
        </Caption>

        <Body
          variant="primary"
          color={colors.text.secondary}
          style={{ marginTop: space[3], lineHeight: 22 }}
        >
          된다(이하 &ldquo;회사&rdquo;)는 사용자의 개인정보를 소중히 다루며, 「개인정보 보호법」 및
          관련 법령을 준수합니다.
        </Body>

        <Section title="1. 수집하는 개인정보 항목" colors={colors} space={space}>
          <SubHeading text="가. 회원가입·로그인 (필수)" colors={colors} space={space} />
          <Bullet text="카카오 계정 식별자(id_token sub)" colors={colors} space={space} />
          <Bullet text="닉네임, 프로필 이미지 URL" colors={colors} space={space} />
          <Bullet text="약관 동의 일시" colors={colors} space={space} />

          <SubHeading text="나. 모임·일정 (서비스 이용 시)" colors={colors} space={space} />
          <Bullet text="모임 이름, 후보 날짜, 투표한 시간대" colors={colors} space={space} />
          <Bullet text="확정 장소(좌표 포함), 모임 멤버" colors={colors} space={space} />
          <Bullet text="친구 관계, 신고·차단 내역" colors={colors} space={space} />

          <SubHeading text="다. 알림 (선택)" colors={colors} space={space} />
          <Bullet text="Expo 푸시 토큰" colors={colors} space={space} />
          <Bullet text="알림 수신 동의 항목" colors={colors} space={space} />

          <SubHeading text="라. 초대 링크 추적 (자동)" colors={colors} space={space} />
          <Bullet
            text="IP 주소 및 User-Agent의 해시값(HMAC-SHA256)"
            colors={colors}
            space={space}
          />
          <Bullet text="클릭 시각" colors={colors} space={space} />
          <Caption
            variant="default"
            color={colors.text.tertiary}
            style={{ marginTop: space[2], lineHeight: 18 }}
          >
            ※ 원본 IP·User-Agent는 저장하지 않으며, 해시값은 친구가 보낸 초대 링크를 클릭한 사람을
            가입 후 24시간 이내 자동으로 모임에 합류시키기 위해서만 사용합니다.
          </Caption>

          <SubHeading text="마. 중간지점 출발지" colors={colors} space={space} />
          <Bullet
            text="중간지점 찾기에 등록한 출발지(장소명·좌표)는 해당 모임 멤버에게만 공개되며, 모임 삭제 또는 탈퇴 시 함께 삭제됩니다"
            colors={colors}
            space={space}
          />
          <Bullet
            text="최근 출발지 칩은 기기에만 저장되며 서버로 전송되지 않습니다"
            colors={colors}
            space={space}
          />
        </Section>

        <Section title="2. 개인정보의 이용 목적" colors={colors} space={space}>
          <Bullet text="회원 식별 및 본인 확인" colors={colors} space={space} />
          <Bullet text="모임 일정 조율 및 푸시 알림 발송" colors={colors} space={space} />
          <Bullet text="초대 링크 매칭(모임 자동 합류)" colors={colors} space={space} />
          <Bullet text="신고·차단 처리, 부정 이용 방지" colors={colors} space={space} />
          <Bullet text="외부 캘린더 연동(사용자가 동의한 경우)" colors={colors} space={space} />
        </Section>

        <Section title="3. 보유·이용 기간" colors={colors} space={space}>
          <Bullet
            text="회원 탈퇴 시까지. 탈퇴 후 즉시 파기(관계 법령상 보존 의무는 예외)"
            colors={colors}
            space={space}
          />
          <Bullet text="모임·일정: 사용자 삭제 또는 모임 종료 시" colors={colors} space={space} />
          <Bullet text="초대 링크 해시: 클릭 후 24시간" colors={colors} space={space} />
        </Section>

        <Section title="4. 제3자 제공" colors={colors} space={space}>
          <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
            회사는 사용자의 개인정보를 제3자에게 제공하지 않습니다.
          </Body>
        </Section>

        <Section title="5. 처리 위탁" colors={colors} space={space}>
          <View
            style={[
              styles.table,
              {
                borderColor: colors.border.subtle,
                borderRadius: radius.md,
                marginTop: space[2],
              },
            ]}
          >
            <TableRow
              left="Supabase"
              right="회원 데이터·일정·푸시 토큰 저장"
              colors={colors}
              space={space}
              isHeader
            />
            <TableRow left="Expo (EAS Push)" right="푸시 알림 발송" colors={colors} space={space} />
            <TableRow left="네이버 클라우드" right="지역검색 API" colors={colors} space={space} />
            <TableRow
              left="Google (Gemini)"
              right="시간표 이미지 OCR (선택 사용)"
              colors={colors}
              space={space}
            />
            <TableRow
              left="Apple / Google"
              right="캘린더 동기화 (선택 동의)"
              colors={colors}
              space={space}
              isLast
            />
          </View>
        </Section>

        <Section title="6. 정보주체의 권리" colors={colors} space={space}>
          <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
            사용자는 언제든지 본인의 개인정보를 열람·정정·삭제·처리 정지 요청할 수 있습니다. 프로필
            화면에서 직접 또는 cs@denda.app으로 요청 시 7일 이내 처리합니다.
          </Body>
        </Section>

        <Section title="7. iOS 앱 추적 투명성(ATT)" colors={colors} space={space}>
          <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
            iOS 사용자는 앱 첫 실행 시 추적 허용 여부를 선택할 수 있습니다. 거부해도 서비스 이용에
            제한이 없으며, 초대 링크 매칭은 IDFA가 아닌 IP/UA 해시로만 동작합니다.
          </Body>
        </Section>

        <Section title="8. 개인정보 보호책임자" colors={colors} space={space}>
          <Body variant="primary" color={colors.text.secondary} style={{ lineHeight: 22 }}>
            이메일: cs@denda.app{'\n'}연락처: 정식 출시 전 갱신 예정
          </Body>
        </Section>

        <Caption
          variant="default"
          color={colors.text.tertiary}
          style={{ marginTop: space[6], lineHeight: 18 }}
        >
          본 방침은 2026-05-29부터 적용됩니다. 정식 출시 시점에 법무 검토 결과를 반영해 갱신될 수
          있으며, 중요 변경 사항은 앱 내 공지로 알려드립니다.
        </Caption>
      </ScrollView>
    </SafeAreaView>
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

function SubHeading({
  text,
  colors,
  space,
}: {
  text: string;
  colors: ReturnType<typeof useTheme>['colors'];
  space: ReturnType<typeof useTheme>['space'];
}) {
  return (
    <Body
      variant="sm-bold"
      color={colors.text.primary}
      style={{ marginTop: space[3], marginBottom: space[1] }}
    >
      {text}
    </Body>
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

function TableRow({
  left,
  right,
  colors,
  space,
  isHeader = false,
  isLast = false,
}: {
  left: string;
  right: string;
  colors: ReturnType<typeof useTheme>['colors'];
  space: ReturnType<typeof useTheme>['space'];
  isHeader?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.tableRow,
        {
          paddingHorizontal: space[3],
          paddingVertical: space[3],
          borderBottomWidth: isLast ? 0 : 1,
          borderBottomColor: colors.border.subtle,
          // 헤더 행은 surface-2로 본문 행과 구분 (surface-1은 배경과 동일해 헤더가 안 보임) — W3-4.
          backgroundColor: isHeader ? colors.surface[2] : 'transparent',
        },
      ]}
    >
      <Body
        variant={isHeader ? 'sm-bold' : 'primary'}
        color={colors.text.primary}
        style={{ flex: 1 }}
      >
        {left}
      </Body>
      <Body variant="primary" color={colors.text.secondary} style={{ flex: 2, lineHeight: 20 }}>
        {right}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  table: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
