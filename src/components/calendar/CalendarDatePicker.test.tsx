import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { CalendarDatePicker } from './CalendarDatePicker';
import { ThemeProvider } from '@/design/theme';

const TODAY = '2026-06-15';
const wrapper = ThemeProvider;

function setup(overrides: Partial<React.ComponentProps<typeof CalendarDatePicker>> = {}) {
  const onToggle = jest.fn();
  const utils = render(
    <CalendarDatePicker
      selected={overrides.selected ?? new Set<string>()}
      onToggle={overrides.onToggle ?? onToggle}
      todayIso={overrides.todayIso ?? TODAY}
      maxSelectable={overrides.maxSelectable}
      monthsAhead={overrides.monthsAhead}
    />,
    { wrapper },
  );
  return { onToggle, ...utils };
}

describe('CalendarDatePicker', () => {
  test('오늘이 속한 달 타이틀을 보여준다', () => {
    const { getByText } = setup();
    expect(getByText('2026년 6월')).toBeTruthy();
  });

  test('일~토 요일 헤더를 렌더한다', () => {
    const { getAllByText } = setup();
    // '일'은 요일 헤더로 최소 1개 존재
    expect(getAllByText('일').length).toBeGreaterThanOrEqual(1);
    expect(getAllByText('토').length).toBeGreaterThanOrEqual(1);
  });

  test('오늘 날짜를 누르면 onToggle(todayIso) 호출', () => {
    const { getByTestId, onToggle } = setup();
    fireEvent.press(getByTestId('calendar-today'));
    expect(onToggle).toHaveBeenCalledWith(TODAY);
  });

  test('선택된 날짜는 accessibilityState.selected = true', () => {
    const { getByTestId } = setup({ selected: new Set([TODAY]) });
    expect(getByTestId('calendar-today').props.accessibilityState?.selected).toBe(true);
  });

  test('지난 날짜는 비활성(누르면 onToggle 미호출)', () => {
    const { getByTestId, onToggle } = setup();
    // 6/10은 오늘(6/15) 이전 → 비활성
    fireEvent.press(getByTestId('calendar-day-2026-06-10'));
    expect(onToggle).not.toHaveBeenCalled();
    expect(getByTestId('calendar-day-2026-06-10').props.accessibilityState?.disabled).toBe(true);
  });

  test('다음 달 이동 → 타이틀 갱신, 이전 버튼으로 복귀', () => {
    const { getByTestId, getByText, queryByText } = setup();
    fireEvent.press(getByTestId('calendar-next'));
    expect(getByText('2026년 7월')).toBeTruthy();
    expect(queryByText('2026년 6월')).toBeNull();
    fireEvent.press(getByTestId('calendar-prev'));
    expect(getByText('2026년 6월')).toBeTruthy();
  });

  test('이번 달에서는 이전 버튼 비활성 (과거 달 금지)', () => {
    const { getByTestId, onToggle } = setup();
    expect(getByTestId('calendar-prev').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(getByTestId('calendar-prev'));
    // 비활성이라 달 변화 없음 — 여전히 오늘 셀 존재
    expect(getByTestId('calendar-today')).toBeTruthy();
    expect(onToggle).not.toHaveBeenCalled();
  });

  test('monthsAhead 한계 달에서는 다음 버튼 비활성', () => {
    const { getByTestId, getByText } = setup({ monthsAhead: 1 });
    fireEvent.press(getByTestId('calendar-next')); // 6월 → 7월 (한계)
    expect(getByText('2026년 7월')).toBeTruthy();
    expect(getByTestId('calendar-next').props.accessibilityState?.disabled).toBe(true);
  });

  test('선택 개수 힌트를 보여준다', () => {
    const { getByText } = setup({ selected: new Set([TODAY]) });
    expect(getByText(/1일 선택/)).toBeTruthy();
  });
});
