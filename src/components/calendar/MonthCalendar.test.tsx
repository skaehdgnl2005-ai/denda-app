import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { MonthCalendar } from './MonthCalendar';
import { ThemeProvider } from '@/design/theme';
import type { DayMarker } from '@/lib/calendar/agenda';

const TODAY = '2026-07-18';
const wrapper = ThemeProvider;

const markers: Record<string, DayMarker> = {
  '2026-07-06': { confirmed: true, voting: false, personal: false, total: 1 },
  '2026-07-07': { confirmed: false, voting: true, personal: false, total: 2 },
  '2026-07-08': { confirmed: false, voting: false, personal: true, total: 1 },
};

function setup(overrides: Partial<React.ComponentProps<typeof MonthCalendar>> = {}) {
  const onSelect = jest.fn();
  const onAnchorChange = jest.fn();
  const utils = render(
    <MonthCalendar
      anchorIso={overrides.anchorIso ?? TODAY}
      onAnchorChange={overrides.onAnchorChange ?? onAnchorChange}
      selectedIso={overrides.selectedIso ?? TODAY}
      onSelect={overrides.onSelect ?? onSelect}
      todayIso={overrides.todayIso ?? TODAY}
      markers={overrides.markers ?? markers}
    />,
    { wrapper },
  );
  return { onSelect, onAnchorChange, ...utils };
}

describe('MonthCalendar', () => {
  test('앵커 달 타이틀과 요일 헤더', () => {
    const { getByText, getByTestId } = setup();
    expect(getByTestId('month-calendar-title').props.children).toBe('2026년 7월');
    ['일', '월', '화', '수', '목', '금', '토'].forEach((w) => expect(getByText(w)).toBeTruthy());
  });

  test('날짜 탭 → onSelect(iso)', () => {
    const { getByTestId, onSelect } = setup();
    fireEvent.press(getByTestId('month-day-2026-07-06'));
    expect(onSelect).toHaveBeenCalledWith('2026-07-06');
  });

  // 개인 캘린더는 과거를 되돌아보는 화면 — CalendarDatePicker(후보일 선택)와 달리 과거도 선택 가능.
  test('과거 날짜도 선택 가능', () => {
    const { getByTestId, onSelect } = setup();
    fireEvent.press(getByTestId('month-day-2026-07-01'));
    expect(onSelect).toHaveBeenCalledWith('2026-07-01');
  });

  test('이전/다음 달 이동 → onAnchorChange (범위 제한 없음)', () => {
    const { getByTestId, onAnchorChange } = setup();
    fireEvent.press(getByTestId('month-calendar-prev'));
    expect(onAnchorChange).toHaveBeenCalledWith('2026-06-01');
    fireEvent.press(getByTestId('month-calendar-next'));
    expect(onAnchorChange).toHaveBeenCalledWith('2026-08-01');
  });

  test('인접 달 날짜는 셀만 차지하고 누를 수 없다', () => {
    const { queryByTestId } = setup();
    expect(queryByTestId('month-day-2026-06-30')).toBeNull();
  });

  describe('마커', () => {
    test('일정이 있는 날에만 마커 노출', () => {
      const { getByTestId, queryByTestId } = setup();
      expect(getByTestId('month-marker-2026-07-06')).toBeTruthy();
      expect(queryByTestId('month-marker-2026-07-09')).toBeNull();
    });

    test('확정 모임은 brand 점, 나머지는 회색 점 (색 단독 의존 금지 — 라벨 동반)', () => {
      const { getByTestId } = setup();
      const confirmed = getByTestId('month-marker-dot-2026-07-06-0');
      const voting = getByTestId('month-marker-dot-2026-07-07-0');
      expect(confirmed.props.style.backgroundColor).not.toBe(voting.props.style.backgroundColor);
    });

    test('a11y 라벨에 날짜·요일·일정 건수·확정 여부 포함', () => {
      const { getByTestId } = setup();
      expect(getByTestId('month-day-2026-07-06').props.accessibilityLabel).toBe(
        '7월 6일 월요일, 일정 1건, 확정 모임 있음',
      );
      expect(getByTestId('month-day-2026-07-07').props.accessibilityLabel).toBe(
        '7월 7일 화요일, 일정 2건',
      );
      expect(getByTestId('month-day-2026-07-09').props.accessibilityLabel).toBe(
        '7월 9일 목요일, 일정 없음',
      );
    });
  });

  test('오늘 셀에 "오늘", 선택 셀에 선택 상태를 알린다', () => {
    const { getByTestId } = setup({ selectedIso: '2026-07-06' });
    expect(getByTestId('month-day-2026-07-18').props.accessibilityLabel).toContain('오늘');
    expect(getByTestId('month-day-2026-07-06').props.accessibilityState).toEqual({
      selected: true,
    });
  });

  test('셀 터치 타깃 44pt (DESIGN §12.1)', () => {
    const { getByTestId } = setup();
    expect(getByTestId('month-day-2026-07-06').props.style.height).toBeGreaterThanOrEqual(44);
  });
});
