import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { DayAgenda } from './DayAgenda';
import { ThemeProvider } from '@/design/theme';
import type { CalendarItem } from '@/lib/calendar/agenda';

const wrapper = ThemeProvider;

const confirmed: CalendarItem = {
  key: 'group:g1',
  kind: 'group-confirmed',
  title: '동아리 회식',
  dateIso: '2026-07-18',
  startMinute: 1140,
  endMinute: 1320,
  subtitle: '강남 이자카야',
  groupId: 'g1',
  scheduleId: null,
};

const voting: CalendarItem = {
  key: 'group:g2:2026-07-18',
  kind: 'group-voting',
  title: '독후감 모임',
  dateIso: '2026-07-18',
  startMinute: null,
  endMinute: null,
  subtitle: null,
  groupId: 'g2',
  scheduleId: null,
};

const klass: CalendarItem = {
  key: 'schedule:s1:2026-07-18',
  kind: 'class',
  title: '선형대수',
  dateIso: '2026-07-18',
  startMinute: 600,
  endMinute: 690,
  subtitle: null,
  groupId: null,
  scheduleId: 's1',
};

const personal: CalendarItem = {
  key: 'schedule:s2:2026-07-18',
  kind: 'personal',
  title: '치과',
  dateIso: '2026-07-18',
  startMinute: 900,
  endMinute: 960,
  subtitle: null,
  groupId: null,
  scheduleId: 's2',
};

function setup(overrides: Partial<React.ComponentProps<typeof DayAgenda>> = {}) {
  const onPressItem = jest.fn();
  const onAddPress = jest.fn();
  const utils = render(
    <DayAgenda
      dateIso={overrides.dateIso ?? '2026-07-18'}
      items={overrides.items ?? [voting, klass, personal, confirmed]}
      onPressItem={overrides.onPressItem ?? onPressItem}
      onAddPress={overrides.onAddPress ?? onAddPress}
    />,
    { wrapper },
  );
  return { onPressItem, onAddPress, ...utils };
}

describe('DayAgenda', () => {
  test('한국어 날짜 헤더', () => {
    const { getByTestId } = setup();
    expect(getByTestId('day-agenda-header').props.children).toBe('7월 18일 (토)');
  });

  test('시간은 tabular-nums로, 시간 미정은 라벨로 표기', () => {
    const { getByTestId, getByText } = setup();
    expect(getByTestId('agenda-time-group:g1').props.children).toBe('19:00');
    expect(getByTestId('agenda-time-group:g1-end').props.children).toBe('22:00');
    expect(getByText('시간 미정')).toBeTruthy();
  });

  test('종류를 색이 아닌 텍스트로도 구분 (§12.6)', () => {
    const { getByText } = setup();
    expect(getByText('모임 · 확정')).toBeTruthy();
    expect(getByText('모임 · 투표 중')).toBeTruthy();
    expect(getByText('수업')).toBeTruthy();
    expect(getByText('내 일정')).toBeTruthy();
  });

  test('확정 모임 부제로 장소명 노출', () => {
    const { getByText } = setup();
    expect(getByText('강남 이자카야')).toBeTruthy();
  });

  test('항목 탭 → onPressItem(item)', () => {
    const { getByTestId, onPressItem } = setup();
    fireEvent.press(getByTestId('agenda-item-group:g1'));
    expect(onPressItem).toHaveBeenCalledWith(confirmed);
  });

  test('"일정 추가" → onAddPress', () => {
    const { getByTestId, onAddPress } = setup();
    fireEvent.press(getByTestId('day-agenda-add'));
    expect(onAddPress).toHaveBeenCalled();
  });

  test('"일정 추가" 터치 타깃 44pt 확보 (hitSlop 포함)', () => {
    const { getByTestId } = setup();
    const btn = getByTestId('day-agenda-add');
    const hs = btn.props.hitSlop;
    expect(hs).toBeDefined();
    expect(20 + hs.top + hs.bottom).toBeGreaterThanOrEqual(44);
  });

  test('빈 날 — 안내 + 추가 CTA (§11.2)', () => {
    const { getByText, getByTestId, onAddPress } = setup({ items: [] });
    expect(getByText('이 날은 일정이 없어요')).toBeTruthy();
    fireEvent.press(getByTestId('day-agenda-empty-cta'));
    expect(onAddPress).toHaveBeenCalled();
  });

  test('a11y 라벨에 시간·제목·종류 포함', () => {
    const { getByTestId } = setup();
    expect(getByTestId('agenda-item-group:g1').props.accessibilityLabel).toBe(
      '19:00부터 22:00까지, 동아리 회식, 모임 · 확정',
    );
    expect(getByTestId('agenda-item-group:g2:2026-07-18').props.accessibilityLabel).toBe(
      '시간 미정, 독후감 모임, 모임 · 투표 중',
    );
  });
});
