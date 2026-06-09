import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ConfirmSlotSheet } from './ConfirmSlotSheet';
import { ThemeProvider } from '@/design/theme';
import type { RecommendedSlot } from '@/lib/groups/recommendSlots';

const wrapper = ThemeProvider;

const REC1: RecommendedSlot = {
  rank: 1,
  dayIndex: 0,
  day: '2026-06-01',
  startMinute: 1140, // 19:00
  endMinute: 1260, // 21:00
  count: 5,
};
const REC2: RecommendedSlot = {
  rank: 2,
  dayIndex: 1,
  day: '2026-06-02',
  startMinute: 1080, // 18:00
  endMinute: 1110, // 18:30
  count: 4,
};

describe('ConfirmSlotSheet', () => {
  test('visible=false → 렌더 안 함', () => {
    const { queryByTestId } = render(
      <ConfirmSlotSheet
        visible={false}
        recommendations={[REC1]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        testID="sheet"
      />,
      { wrapper },
    );
    expect(queryByTestId('sheet')).toBeNull();
  });

  test('추천 목록 — 시간 범위·인원수 표시', () => {
    const { getByText } = render(
      <ConfirmSlotSheet
        visible
        recommendations={[REC1, REC2]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        testID="sheet"
      />,
      { wrapper },
    );
    expect(getByText('19:00 ~ 21:00')).toBeTruthy();
    expect(getByText('5명 가능')).toBeTruthy();
    expect(getByText('18:00 ~ 18:30')).toBeTruthy();
    expect(getByText('4명 가능')).toBeTruthy();
  });

  test('날짜 라벨 — 월/일 표시', () => {
    const { getByText } = render(
      <ConfirmSlotSheet
        visible
        recommendations={[REC1]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        testID="sheet"
      />,
      { wrapper },
    );
    expect(getByText(/^6\/1/)).toBeTruthy();
  });

  test('빈 추천 → 빈 상태 메시지', () => {
    const { getByText, queryByTestId } = render(
      <ConfirmSlotSheet
        visible
        recommendations={[]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
        testID="sheet"
      />,
      { wrapper },
    );
    expect(getByText(/아직 추천할 시간이 없어요/)).toBeTruthy();
    expect(queryByTestId('sheet-slot-0')).toBeNull();
  });

  test('추천 항목 탭 → onSelect(해당 추천) 호출', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <ConfirmSlotSheet
        visible
        recommendations={[REC1, REC2]}
        onSelect={onSelect}
        onClose={jest.fn()}
        testID="sheet"
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('sheet-slot-1'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(REC2);
  });

  test('취소 → onClose 호출', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ConfirmSlotSheet
        visible
        recommendations={[REC1]}
        onSelect={jest.fn()}
        onClose={onClose}
        testID="sheet"
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('sheet-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('inflight=true → 항목 탭 무시 (중복 확정 방어)', () => {
    const onSelect = jest.fn();
    const { getByTestId } = render(
      <ConfirmSlotSheet
        visible
        recommendations={[REC1]}
        onSelect={onSelect}
        onClose={jest.fn()}
        inflight
        testID="sheet"
      />,
      { wrapper },
    );
    fireEvent.press(getByTestId('sheet-slot-0'));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
