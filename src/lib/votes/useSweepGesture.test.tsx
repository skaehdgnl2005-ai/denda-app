// useSweepGesture — Reanimated worklet + Gesture.Pan drag sweep hook.
//
// D12 의무 패턴 검증:
//   - 시작 cell은 selection 토글 모드(add/remove)를 결정 (baseline[startKey] 기반)
//   - drag 진행 시 baseline + sweep rect를 selection.value에 즉시 반영 (UI thread)
//   - drag 종료 시 runOnJS(onCommit)로 JS thread 호출 (debounce는 caller 책임)
//
// 본 hook은 mock 환경에서 _handlers를 직접 호출하여 worklet 동작을 검증한다.
// 실제 60fps 검증은 production binary에서만 가능 (S05e — 실기기 필요).

import { renderHook } from '@testing-library/react-native';
import { useSharedValue } from 'react-native-reanimated';
import {
  useSweepGesture,
  type UseSweepGestureOptions,
  type UseSweepGestureResult,
} from './useSweepGesture';
import type { GridLayout } from '@/lib/heatmap/coords';

interface GestureHandlers {
  onStart?: (e: { x: number; y: number }) => void;
  onUpdate?: (e: { x: number; y: number }) => void;
  onEnd?: () => void;
}

type GestureWithHandlers = { _handlers: GestureHandlers };

function handlersOf(panGesture: UseSweepGestureResult['panGesture']): GestureHandlers {
  return (panGesture as unknown as GestureWithHandlers)._handlers;
}

interface SweepHookResult extends UseSweepGestureResult {
  layout: ReturnType<typeof useSharedValue<GridLayout>>;
  onCommit: jest.Mock;
}

const DAYS = [
  '2026-05-30',
  '2026-05-31',
  '2026-06-01',
  '2026-06-02',
  '2026-06-03',
  '2026-06-04',
  '2026-06-05',
];

const DEFAULT_LAYOUT: GridLayout = {
  headerWidth: 50,
  cellHeight: 10,
  cellWidth: 40,
  rowCount: 60,
  colCount: 7,
  scrollOffsetY: 0,
};

function renderSweep(
  override: Partial<UseSweepGestureOptions> = {},
): ReturnType<typeof renderHook<SweepHookResult, unknown>> {
  const onCommit = (override.onCommit as jest.Mock | undefined) ?? jest.fn();
  return renderHook<SweepHookResult, unknown>(() => {
    const layout = useSharedValue<GridLayout>({ ...DEFAULT_LAYOUT });
    return {
      ...useSweepGesture({
        days: DAYS,
        layout,
        ...override,
        onCommit,
      }),
      layout,
      onCommit,
    };
  });
}

describe('useSweepGesture', () => {
  test('onStart: 시작 cell이 selection에 추가됨 (add 모드, long-press 통과 시점)', () => {
    const { result } = renderSweep();
    handlersOf(result.current.panGesture).onStart?.({ x: 51, y: 1 });
    expect(result.current.selection.value['0:540']).toBe(true);
  });

  test('onUpdate: drag rect 전체가 selection에 반영', () => {
    const { result } = renderSweep();
    const h = handlersOf(result.current.panGesture);
    h.onStart?.({ x: 51, y: 1 }); // row=0, col=0
    h.onUpdate?.({ x: 51 + 40, y: 11 }); // row=1, col=1
    const sel = result.current.selection.value;
    expect(sel['0:540']).toBe(true);
    expect(sel['0:555']).toBe(true);
    expect(sel['1:540']).toBe(true);
    expect(sel['1:555']).toBe(true);
  });

  test('onEnd: onCommit이 selection 기반 VoteSlot[]로 호출됨', () => {
    const onCommit = jest.fn();
    const { result } = renderSweep({ onCommit });
    const h = handlersOf(result.current.panGesture);
    h.onStart?.({ x: 51, y: 1 });
    h.onEnd?.();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith([{ day: '2026-05-30', start_minute: 540 }]);
  });

  test('remove 모드: 이미 선택된 cell 시작 → drag 영역이 제거됨', () => {
    const initialSelection = { '0:540': true, '0:555': true, '6:540': true };
    const onCommit = jest.fn();
    const { result } = renderSweep({ initialSelection, onCommit });
    const h = handlersOf(result.current.panGesture);
    h.onStart?.({ x: 51, y: 1 }); // row=0, col=0 — 이미 true → remove 모드
    h.onUpdate?.({ x: 51, y: 11 }); // row=0~1, col=0
    h.onEnd?.();
    expect(onCommit).toHaveBeenCalledWith(
      expect.arrayContaining([{ day: '2026-06-05', start_minute: 540 }]),
    );
    // 0:540, 0:555 모두 제거
    expect(onCommit).toHaveBeenCalledWith(
      expect.not.arrayContaining([{ day: '2026-05-30', start_minute: 540 }]),
    );
    expect(onCommit).toHaveBeenCalledWith(
      expect.not.arrayContaining([{ day: '2026-05-30', start_minute: 555 }]),
    );
  });

  test('헤더 영역 outside (x < headerWidth): onStart 무시 + onCommit 안 부름', () => {
    const onCommit = jest.fn();
    const { result } = renderSweep({ onCommit });
    const h = handlersOf(result.current.panGesture);
    h.onStart?.({ x: 30, y: 5 });
    h.onEnd?.();
    expect(onCommit).not.toHaveBeenCalled();
  });

  test('scrollOffsetY는 onStart 매핑에 무시됨 — pt.y는 view-local (2026-06-05 regression)', () => {
    // RNGH가 GestureDetector 부착 view-local 좌표를 보고 → pt.y에 스크롤 이미 포함됨.
    // scrollOffsetY를 더하면 이중 가산 → SelectionOverlay가 드래그보다 더 아래·더 길게
    // 그려지는 회귀 (dev client 실기기 확인).
    const { result } = renderSweep();
    result.current.scrollOffsetY.value = 100; // scroll 상태여도
    const h = handlersOf(result.current.panGesture);
    h.onStart?.({ x: 51, y: 1 }); // y=1 자체 → row=0 (스크롤 가산 X)
    const sm = 540 + 0 * 15; // 540
    expect(result.current.selection.value[`0:${sm}`]).toBe(true);
  });

  test('재진입(onStart → onEnd → 다시 onStart)에서 baseline 갱신', () => {
    const onCommit = jest.fn();
    const { result } = renderSweep({ onCommit });
    const h = handlersOf(result.current.panGesture);

    h.onStart?.({ x: 51, y: 1 }); // (0,0) add
    h.onEnd?.();
    h.onStart?.({ x: 51, y: 1 }); // 같은 cell, 이번엔 이미 true → remove 모드
    h.onEnd?.();

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenNthCalledWith(1, [{ day: '2026-05-30', start_minute: 540 }]);
    expect(onCommit).toHaveBeenNthCalledWith(2, []);
  });
});
