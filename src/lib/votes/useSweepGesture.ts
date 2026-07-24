// useSweepGesture — Reanimated worklet + Gesture.Pan 기반 sweep selection hook.
//
// D12 의무 패턴 (DECISIONS.md#d12):
//   - 셀 상태 = useSharedValue (JS state X)
//   - drag = UI thread worklet
//   - drag 종료 시 1회 runOnJS(commit) — 100ms debounce는 caller 책임
//
// 활성화 정책 (2026-06-08):
//   - .activateAfterLongPress(300) — 꾹 누름 300ms 후에만 Pan 활성.
//   - 그냥 드래그 = Pan 비활성 상태 → 부모 ScrollView가 자연스럽게 세로 스크롤 받음.
//   - 꾹 누름 + 드래그 = Pan 활성 → RNGH가 ScrollView로부터 gesture 권리 회수.
//   - 결과: scrollEnabled toggle 불필요. 회귀(Issue 1, 2026-06-05) 자연 해소.
//
// 동작:
//   - onStart: long press 통과 시점. 시작 cell이 baseline에 false였으면 add 모드,
//              true였으면 remove 모드. baseline = selection snapshot.
//   - onUpdate: applySweepToRecord(baseline, start, end, toggleAdd) → selection.value 갱신.
//   - onEnd: runOnJS(jsCommit)(selection.value). jsCommit이 selectionToVoteSlots로 변환 + onCommit 호출.
//
// 입력:
//   - days: groups.dates DATE[] (col index → ISO date, D11 day_index와 동일 매핑)
//   - layout: SharedValue<GridLayout> — Grid의 onLayout/onScroll로 갱신
//   - initialSelection: 첫 mount 시 selfMarks를 record로 변환한 결과
//   - onCommit: drag 종료 시 호출되는 콜백 (caller에서 100ms debounce + commitVoteDiff 위임)
//
// scrollOffsetY는 SharedValue로 별도 노출 — Grid의 ScrollView onScroll에서 갱신.

import { useEffect } from 'react';
import { Gesture, type PanGesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, type SharedValue } from 'react-native-reanimated';

import { pointToCell, type GridLayout } from '@/lib/heatmap/coords';
import { applySweepToRecord, type CellCoord } from '@/lib/heatmap/sweep';
import type { SlotKey } from '@/lib/heatmap/types';

import { selectionToVoteSlots, type VoteSlot } from './voteSet';

const SLOT_MINUTES = 15;
const GRID_START_MINUTE = 540; // 09:00

export interface UseSweepGestureOptions {
  days: readonly string[];
  layout: SharedValue<GridLayout>;
  initialSelection?: Record<SlotKey, boolean>;
  onCommit: (slots: VoteSlot[]) => void;
}

/** 꾹 누름으로 sweep 활성화하는 임계값 (ms). 너무 짧으면 평범한 탭이 sweep로 잘못 인식,
 * 너무 길면 답답함. 300ms = Google Calendar 수준. */
const LONG_PRESS_MS = 300;

export interface UseSweepGestureResult {
  panGesture: PanGesture;
  selection: SharedValue<Record<SlotKey, boolean>>;
  scrollOffsetY: SharedValue<number>;
  // SelectionOverlay가 useAnimatedStyle로 구독해 drag 중 사각형 즉시 그림 (Issue 1A).
  // null = drag 비활성 (overlay 숨김).
  startCoord: SharedValue<CellCoord | null>;
  currentCoord: SharedValue<CellCoord | null>;
  // add 모드(true) = 보라색 fill / remove 모드(false) = 회색 X — overlay가 색 분기
  toggleAdd: SharedValue<boolean>;
}

export function useSweepGesture(options: UseSweepGestureOptions): UseSweepGestureResult {
  const { days, layout, initialSelection, onCommit } = options;

  const selection = useSharedValue<Record<SlotKey, boolean>>(initialSelection ?? {});
  const baseline = useSharedValue<Record<SlotKey, boolean>>(initialSelection ?? {});
  const startCoord = useSharedValue<CellCoord | null>(null);
  const currentCoord = useSharedValue<CellCoord | null>(null);
  const toggleAdd = useSharedValue<boolean>(true);
  const scrollOffsetY = useSharedValue<number>(0);

  // useSharedValue는 첫 렌더 값만 쓰는데 실전에서 initialSelection(기존 투표)은 fetch가
  // 마운트 후 resolve된 뒤에야 도착한다 — effect로 재시드하지 않으면 sweep 1회에 기존
  // 투표 전체가 diff의 removed로 서버에서 삭제된다. 드래그 진행 중(startCoord 有)에는
  // 진행 중인 selection을 훼손하지 않도록 건너뛴다 (commit 후 재렌더에서 멱등 재시드).
  useEffect(() => {
    if (initialSelection !== undefined && startCoord.value === null) {
      // eslint-disable-next-line react-hooks/immutability -- SharedValue 시드 (worklet 계약)
      selection.value = initialSelection;
    }
  }, [initialSelection, selection, startCoord]);

  // jsCommit은 매 render마다 재생성 (days/onCommit closure 캡쳐).
  // panGesture도 매 render마다 재생성 — gesture-handler가 동등성 비교로 처리.
  const jsCommit = (snapshot: Record<SlotKey, boolean>): void => {
    onCommit(selectionToVoteSlots(snapshot, days));
  };

  const panGesture = Gesture.Pan()
    // 꾹 누름 후에만 sweep 활성. 그냥 드래그는 부모 ScrollView가 받아 세로 스크롤로 진행.
    .activateAfterLongPress(LONG_PRESS_MS)
    .onStart((e: { x: number; y: number }) => {
      'worklet';
      const layoutWithScroll: GridLayout = { ...layout.value, scrollOffsetY: scrollOffsetY.value };
      const start = pointToCell({ x: e.x, y: e.y }, layoutWithScroll);
      if (!start) return;
      startCoord.value = start;
      currentCoord.value = start;
      baseline.value = selection.value;
      const startMinute = GRID_START_MINUTE + start.row * SLOT_MINUTES;
      const startKey = `${start.col}:${startMinute}` as SlotKey;
      const add = baseline.value[startKey] !== true;
      toggleAdd.value = add;
      selection.value = applySweepToRecord(baseline.value, start, start, add);
    })
    .onUpdate((e: { x: number; y: number }) => {
      'worklet';
      const start = startCoord.value;
      if (!start) return;
      const layoutWithScroll: GridLayout = { ...layout.value, scrollOffsetY: scrollOffsetY.value };
      const end = pointToCell({ x: e.x, y: e.y }, layoutWithScroll);
      if (!end) return;
      currentCoord.value = end;
      selection.value = applySweepToRecord(baseline.value, start, end, toggleAdd.value);
    })
    .onEnd(() => {
      'worklet';
      if (startCoord.value === null) return;
      startCoord.value = null;
      currentCoord.value = null;
      runOnJS(jsCommit)(selection.value);
    });

  return { panGesture, selection, scrollOffsetY, startCoord, currentCoord, toggleAdd };
}
