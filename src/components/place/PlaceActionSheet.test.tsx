import React from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlaceActionSheet, type PlaceActionSheetProps } from './PlaceActionSheet';
import { ThemeProvider } from '@/design/theme';
import { tokens } from '@/design/tokens';

const PLACE = {
  id: '11111111-2222-3333-4444-555555555555',
  name: '한솥도시락 안암점',
  category: '한식',
  address: '서울 성북구 안암동',
};

function renderSheet(overrides: Partial<PlaceActionSheetProps> = {}) {
  const props: PlaceActionSheetProps = {
    visible: true,
    onClose: jest.fn(),
    place: PLACE,
    groupName: '5/30 저녁',
    isPartnership: false,
    onReservationPress: jest.fn().mockResolvedValue(undefined),
    onSharePress: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return {
    ...render(<PlaceActionSheet {...props} />, { wrapper: ThemeProvider }),
    props,
  };
}

describe('PlaceActionSheet', () => {
  it('visible=false → 시트 노출 안 됨', () => {
    const { queryByTestId } = renderSheet({ visible: false });
    expect(queryByTestId('place-action-sheet')).toBeNull();
  });

  it('visible=true → 장소명 + 카테고리 + 주소 + grabber 노출', () => {
    const { getByText, getByTestId } = renderSheet();
    expect(getByText('한솥도시락 안암점')).toBeTruthy();
    expect(getByText('한식')).toBeTruthy();
    expect(getByText('서울 성북구 안암동')).toBeTruthy();
    expect(getByTestId('place-action-sheet-grabber')).toBeTruthy();
  });

  it('"예약은 준비 중" 안내 chip 노출 (Phase 1+2 baseline)', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('phase12-notice')).toBeTruthy();
  });

  it('backdrop 배경색 = overlay.scrim 토큰 (하드코딩 금지, §10.3)', () => {
    const { getByTestId } = renderSheet();
    const style = StyleSheet.flatten(getByTestId('place-action-sheet-backdrop').props.style);
    expect(style.backgroundColor).toBe(tokens.light.overlay.scrim);
  });

  it('CTA 높이 = 56pt (§10.3 CTA 높이)', () => {
    const { getByTestId } = renderSheet();
    const reservation = StyleSheet.flatten(getByTestId('reservation-cta').props.style);
    const share = StyleSheet.flatten(getByTestId('share-cta').props.style);
    expect(reservation.minHeight).toBe(56);
    expect(share.minHeight).toBe(56);
  });

  it('"예약하기" press → onReservationPress 호출 → 성공 후 onClose 호출', async () => {
    const onReservationPress = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onReservationPress, onClose });
    await act(async () => {
      fireEvent.press(getByTestId('reservation-cta'));
    });
    expect(onReservationPress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('"장소만 정하기" press → onSharePress 호출 → 성공 후 onClose 호출', async () => {
    const onSharePress = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onSharePress, onClose });
    await act(async () => {
      fireEvent.press(getByTestId('share-cta'));
    });
    expect(onSharePress).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('"예약하기" inflight 중 추가 press → onReservationPress 1번만 (더블 탭 방어)', async () => {
    let resolveFn = () => {};
    const onReservationPress = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const { getByTestId } = renderSheet({ onReservationPress });
    await act(async () => {
      fireEvent.press(getByTestId('reservation-cta'));
    });
    // 두 번째 탭 — inflight 중이므로 추가 호출 없어야
    await act(async () => {
      fireEvent.press(getByTestId('reservation-cta'));
    });
    expect(onReservationPress).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveFn();
    });
  });

  it('동기 더블탭(같은 tick) → onReservationPress 1번만 (Gate #2 click 정확도)', async () => {
    // 같은 tick에 두 번 press — useState busy 가드만으로는 stale closure로 둘 다 통과할 수 있다.
    // ref 동기 가드 + native disabled 로 두 번째를 즉시 차단해야 한다 (1 event만 로그).
    const onReservationPress = jest.fn().mockImplementation(() => new Promise<void>(() => {}));
    const { getByTestId } = renderSheet({ onReservationPress });
    const cta = getByTestId('reservation-cta');
    await act(async () => {
      fireEvent.press(cta);
      fireEvent.press(cta);
    });
    expect(onReservationPress).toHaveBeenCalledTimes(1);
  });

  it('inflight 중 reservation-cta·share-cta 비활성(accessibilityState.disabled) — 가짜 affordance 차단', async () => {
    const onReservationPress = jest.fn().mockImplementation(() => new Promise<void>(() => {}));
    const { getByTestId } = renderSheet({ onReservationPress });
    await act(async () => {
      fireEvent.press(getByTestId('reservation-cta'));
    });
    expect(getByTestId('reservation-cta').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('share-cta').props.accessibilityState.disabled).toBe(true);
  });

  it('"예약하기" 실패 → 한국어 에러 메시지 노출 + sheet 유지', async () => {
    const onReservationPress = jest
      .fn()
      .mockRejectedValue(new Error('네트워크 오류가 발생했어요.'));
    const onClose = jest.fn();
    const { getByTestId, getByText } = renderSheet({ onReservationPress, onClose });
    await act(async () => {
      fireEvent.press(getByTestId('reservation-cta'));
    });
    await waitFor(() => expect(getByText(/네트워크 오류/)).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('"장소만 정하기" 실패 → 한국어 에러 메시지 노출 + sheet 유지', async () => {
    const onSharePress = jest.fn().mockRejectedValue(new Error('공유에 실패했어요.'));
    const onClose = jest.fn();
    const { getByTestId, getByText } = renderSheet({ onSharePress, onClose });
    await act(async () => {
      fireEvent.press(getByTestId('share-cta'));
    });
    await waitFor(() => expect(getByText(/공유에 실패/)).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();
  });

  it('backdrop press → onClose 호출', () => {
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onClose });
    fireEvent.press(getByTestId('place-action-sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('inflight 중 backdrop press → onClose 호출 안 됨', async () => {
    let resolveFn = () => {};
    const onReservationPress = jest.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const onClose = jest.fn();
    const { getByTestId } = renderSheet({ onReservationPress, onClose });
    await act(async () => {
      fireEvent.press(getByTestId('reservation-cta'));
    });
    fireEvent.press(getByTestId('place-action-sheet-backdrop'));
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => {
      resolveFn();
    });
  });

  it('카테고리/주소 없을 때 — placeName만 노출 (no crash)', () => {
    const { getByText, queryByText } = renderSheet({
      place: { id: PLACE.id, name: '식당명' },
    });
    expect(getByText('식당명')).toBeTruthy();
    expect(queryByText('한식')).toBeNull();
  });

  it('"예약하기" + "장소만 정하기" 버튼 accessibilityRole=button', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('reservation-cta').props.accessibilityRole).toBe('button');
    expect(getByTestId('share-cta').props.accessibilityRole).toBe('button');
  });

  it('isPartnership=true → 제휴 배지 노출 (M4 시각 capability — 카드)', () => {
    const { getByTestId } = renderSheet({ isPartnership: true });
    expect(getByTestId('partner-badge')).toBeTruthy();
  });

  it('isPartnership=false → 제휴 배지 미노출', () => {
    const { queryByTestId } = renderSheet({ isPartnership: false });
    expect(queryByTestId('partner-badge')).toBeNull();
  });
});

// W2-15 후속 — 시트 모션 rework: RN 기본 animationType="slide" 대신 자체 Animated
// 슬라이드-업(§6.5 바텀시트 up = medium+enter) + backdrop 페이드 + 모션 감소 즉시(§6.4).
// D12 드래그 그리드 worklet과 무관(RN Animated, Reanimated 아님).
describe('PlaceActionSheet — 시트 모션 (§6.5 / §6.4)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Modal animationType="none" — RN 기본 슬라이드 대신 자체 모션', () => {
    const { getByTestId } = renderSheet();
    expect(getByTestId('place-action-sheet').props.animationType).toBe('none');
  });

  it('시트가 translateY 슬라이드-업 모션으로 등장 (기본 = 모션 유지)', () => {
    const { getByTestId } = renderSheet();
    const sheet = StyleSheet.flatten(getByTestId('place-action-sheet-sheet').props.style);
    expect(Array.isArray(sheet.transform)).toBe(true);
    expect((sheet.transform as unknown[]).length).toBeGreaterThan(0);
  });

  it('모션 감소 시 슬라이드 없이 즉시 (transform 비움, §6.4)', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const { getByTestId } = renderSheet();
    await waitFor(() => {
      const sheet = StyleSheet.flatten(getByTestId('place-action-sheet-sheet').props.style);
      expect(sheet.transform).toEqual([]);
    });
  });

  it('닫히면(visible=false) exit 모션 후 시트를 언마운트한다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const base: PlaceActionSheetProps = {
      visible: true,
      onClose: jest.fn(),
      place: PLACE,
      groupName: '5/30 저녁',
      isPartnership: false,
      onReservationPress: jest.fn().mockResolvedValue(undefined),
      onSharePress: jest.fn().mockResolvedValue(undefined),
    };
    const { rerender, queryByTestId } = render(<PlaceActionSheet {...base} />, {
      wrapper: ThemeProvider,
    });
    expect(queryByTestId('place-action-sheet')).toBeTruthy();

    await act(async () => {
      rerender(<PlaceActionSheet {...base} visible={false} />);
    });
    await waitFor(() => expect(queryByTestId('place-action-sheet')).toBeNull());
  });
});
