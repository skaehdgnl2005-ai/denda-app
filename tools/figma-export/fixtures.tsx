// Figma로 내보낼 대상 선언 — Storybook 없는 스토리.
// 여기 없는 건 export되지 않는다. 추가는 이 배열에 항목을 넣는 것으로 끝난다.
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { EmptyState } from '@/components/EmptyState';
import { Icon, iconMap, type IconName } from '@/components/Icon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SearchField } from '@/components/SearchField';
import { Skeleton } from '@/components/Skeleton';
import { Spinner } from '@/components/Spinner';
import { BrandMark } from '@/components/brand/BrandMark';
import { HeatRampRow } from '@/components/brand/HeatRampRow';
import { MiniCalendar } from '@/components/brand/MiniCalendar';
import { MiniMap } from '@/components/brand/MiniMap';
import { MiniTimeGrid } from '@/components/brand/MiniTimeGrid';
import { tokens } from '@/design/tokens';
import { Body, Caption, Title } from '@/design/typography';

export interface Fixture {
  /** dump.json 및 Figma 레이어 이름에 쓰인다. */
  id: string;
  /** Figma 페이지 안의 섹션 라벨. */
  group: string;
  name: string;
  element: React.ReactElement;
  /** 화면처럼 폭을 고정해야 하면 지정. null이면 내용에 맞춤. */
  frameWidth?: number;
}

const noop = (): void => {};

// --- 토큰 시트 (합성 픽스처) --------------------------------------------------
// 앱 화면에는 없지만 디자인 시스템 라이브러리에는 반드시 필요한 것들.

function Swatch({ color, label }: { color: string; label: string }): React.ReactElement {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: tokens.radius.md,
          backgroundColor: color,
          borderWidth: 1,
          borderColor: tokens.light.border.subtle,
        }}
      />
      <Caption variant="micro">{label}</Caption>
    </View>
  );
}

function SwatchRow({
  entries,
  title,
}: {
  entries: [string, string][];
  title: string;
}): React.ReactElement {
  return (
    <View style={{ gap: 8 }}>
      <Caption variant="default">{title}</Caption>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {entries.map(([label, color]) => (
          <Swatch key={label} color={color} label={label} />
        ))}
      </View>
    </View>
  );
}

function ColorSheet(): React.ReactElement {
  const c = tokens.light;
  return (
    <View style={{ gap: 24, padding: 16 }}>
      <SwatchRow
        title="brand"
        entries={Object.entries(c.brand).map(([k, v]) => [k, v] as [string, string])}
      />
      <SwatchRow
        title="surface"
        entries={Object.entries(c.surface).map(([k, v]) => [k, v] as [string, string])}
      />
      <SwatchRow
        title="text"
        entries={Object.entries(c.text).map(([k, v]) => [k, v] as [string, string])}
      />
      <SwatchRow title="heat ramp" entries={c.heat.map((v, i) => [`heat-${i}`, v])} />
      <SwatchRow
        title="semantic"
        entries={Object.entries(c.semantic).map(([k, v]) => [k, v.solid] as [string, string])}
      />
    </View>
  );
}

function TypeSheet(): React.ReactElement {
  return (
    <View style={{ gap: 16, padding: 16 }}>
      <Title level="display">display 32/40</Title>
      <Title level="h1">title-1 24/32</Title>
      <Title level="h2">title-2 20/28</Title>
      <Title level="h3">title-3 18/24</Title>
      <Body variant="primary">body 16/24 — 다음 주 언제 만날까요?</Body>
      <Body variant="bold">body-bold 16/24 — 모임이 확정됐어요</Body>
      <Body variant="sm">body-sm 14/20 — 참여자 7명</Body>
      <Body variant="sm-bold">body-sm-bold 14/20</Body>
      <Caption variant="default">caption 13/18</Caption>
      <Caption variant="micro">micro 11/16</Caption>
      <Body variant="bold" tabularNums>
        숫자 정렬 1,234,567
      </Body>
    </View>
  );
}

function SpacingSheet(): React.ReactElement {
  const scale = Object.entries(tokens.space) as [string, number][];
  return (
    <View style={{ gap: 8, padding: 16 }}>
      {scale.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 48 }}>
            <Caption variant="micro">{`space-${k}`}</Caption>
          </View>
          <View style={{ height: 16, width: v || 1, backgroundColor: tokens.light.brand[500] }} />
          <Caption variant="micro">{`${v}pt`}</Caption>
        </View>
      ))}
    </View>
  );
}

function IconSheet(): React.ReactElement {
  const names = Object.keys(iconMap) as IconName[];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16, width: 360 }}>
      {names.map((n) => (
        <View key={n} style={{ alignItems: 'center', gap: 4, width: 64 }}>
          <Icon name={n} size={24} />
          <Caption variant="micro">{n}</Caption>
        </View>
      ))}
    </View>
  );
}

// --- 픽스처 목록 --------------------------------------------------------------

export const fixtures: Fixture[] = [
  // 토큰 시트
  { id: 'tokens/color', group: 'Foundations', name: '색 팔레트', element: <ColorSheet /> },
  { id: 'tokens/type', group: 'Foundations', name: '타이포그래피', element: <TypeSheet /> },
  { id: 'tokens/spacing', group: 'Foundations', name: '간격 스케일', element: <SpacingSheet /> },
  { id: 'tokens/icons', group: 'Foundations', name: '아이콘 전체', element: <IconSheet /> },

  // Button
  {
    id: 'button/primary-lg',
    group: 'Buttons',
    name: 'Primary · lg',
    element: <Button label="확인" onPress={noop} variant="primary" size="lg" />,
  },
  {
    id: 'button/primary-md',
    group: 'Buttons',
    name: 'Primary · md',
    element: <Button label="확인" onPress={noop} variant="primary" size="md" />,
  },
  {
    id: 'button/secondary',
    group: 'Buttons',
    name: 'Secondary',
    element: <Button label="취소" onPress={noop} variant="secondary" />,
  },
  {
    id: 'button/ghost',
    group: 'Buttons',
    name: 'Ghost',
    element: <Button label="나중에" onPress={noop} variant="ghost" />,
  },
  {
    id: 'button/destructive',
    group: 'Buttons',
    name: 'Destructive',
    element: <Button label="모임 나가기" onPress={noop} variant="destructive" />,
  },
  {
    id: 'button/kakao',
    group: 'Buttons',
    name: 'Kakao',
    element: <Button label="카카오로 시작하기" onPress={noop} variant="kakao" />,
  },
  {
    id: 'button/disabled',
    group: 'Buttons',
    name: 'Primary · disabled',
    element: <Button label="확인" onPress={noop} disabled />,
  },
  {
    id: 'button/loading',
    group: 'Buttons',
    name: 'Primary · loading',
    element: <Button label="저장 중" onPress={noop} loading />,
  },
  {
    id: 'button/with-icon',
    group: 'Buttons',
    name: 'Primary · 아이콘',
    element: <Button label="모임 확정" onPress={noop} leftIcon="확정" />,
  },
  {
    id: 'button/inline',
    group: 'Buttons',
    name: 'Primary · inline',
    element: <Button label="추가" onPress={noop} fullWidth={false} />,
  },

  // 상태 표시
  {
    id: 'state/empty-default',
    group: 'States',
    name: '빈 상태 · 기본',
    element: <EmptyState title="아직 모임이 없어요" body="친구를 초대해 첫 모임을 만들어보세요." />,
  },
  {
    id: 'state/empty-cta',
    group: 'States',
    name: '빈 상태 · CTA',
    element: (
      <EmptyState
        title="친구가 없어요"
        body="아이디로 친구를 찾아보세요."
        icon="친구"
        cta={{ label: '친구 찾기', onPress: noop }}
      />
    ),
  },
  {
    id: 'state/empty-error',
    group: 'States',
    name: '에러 상태',
    element: (
      <EmptyState
        title="불러오지 못했어요"
        body="잠시 후 다시 시도해주세요."
        variant="error"
        cta={{ label: '다시 시도', onPress: noop }}
      />
    ),
  },
  {
    id: 'state/spinner',
    group: 'States',
    name: '스피너',
    element: (
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', padding: 16 }}>
        <Spinner size={24} />
        <Spinner size={16} />
      </View>
    ),
  },
  {
    id: 'state/skeleton',
    group: 'States',
    name: '스켈레톤',
    element: (
      <View style={{ gap: 8, padding: 16, width: 320 }}>
        <Skeleton width="60%" height={20} />
        <Skeleton width="100%" height={16} />
        <Skeleton width="80%" height={16} />
      </View>
    ),
  },

  // 내비게이션 · 입력
  {
    id: 'nav/header-title',
    group: 'Navigation',
    name: '헤더 · 타이틀만',
    element: <ScreenHeader title="내 모임" />,
  },
  {
    id: 'nav/header-back',
    group: 'Navigation',
    name: '헤더 · 뒤로',
    element: <ScreenHeader title="모임 만들기" onBack={noop} />,
  },
  {
    id: 'input/search-empty',
    group: 'Inputs',
    name: '검색 · 비어 있음',
    element: (
      <SearchField
        value=""
        onChangeText={noop}
        placeholder="장소 검색"
        accessibilityLabel="장소 검색"
      />
    ),
  },
  {
    id: 'input/search-filled',
    group: 'Inputs',
    name: '검색 · 입력됨',
    element: (
      <SearchField
        value="홍대 카페"
        onChangeText={noop}
        placeholder="장소 검색"
        accessibilityLabel="장소 검색"
      />
    ),
  },

  // 시트
  {
    id: 'sheet/confirm',
    group: 'Sheets',
    name: '확인 시트',
    element: (
      <ConfirmSheet
        visible
        onClose={noop}
        title="이 시간으로 확정할까요?"
        message="확정하면 참여자에게 알림이 갑니다."
        confirmLabel="확정하기"
        onConfirm={noop}
      />
    ),
  },
  {
    id: 'sheet/confirm-destructive',
    group: 'Sheets',
    name: '확인 시트 · 파괴적',
    element: (
      <ConfirmSheet
        visible
        onClose={noop}
        title="모임을 나갈까요?"
        message="나가면 다시 초대받아야 합니다."
        confirmLabel="나가기"
        onConfirm={noop}
        destructive
      />
    ),
  },

  // 브랜드 요소
  {
    id: 'brand/mark',
    group: 'Brand',
    name: '브랜드 마크',
    element: (
      <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-end', padding: 16 }}>
        <BrandMark size="sm" />
        <BrandMark size="md" />
        <BrandMark size="lg" />
      </View>
    ),
  },
  {
    id: 'brand/heat-ramp',
    group: 'Brand',
    name: '히트맵 램프',
    element: <HeatRampRow showLabel />,
  },
  {
    id: 'brand/mini-calendar',
    group: 'Brand',
    name: '미니 캘린더',
    element: <MiniCalendar />,
  },
  { id: 'brand/mini-map', group: 'Brand', name: '미니 지도', element: <MiniMap /> },
  {
    id: 'brand/mini-time-grid',
    group: 'Brand',
    name: '미니 시간 그리드',
    element: <MiniTimeGrid />,
  },
];
