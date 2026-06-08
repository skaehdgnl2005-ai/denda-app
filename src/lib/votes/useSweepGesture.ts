// useSweepGesture — Reanimated worklet + Gesture.Pan 기반 sweep selection hook.
//
// D12 의무 패턴 (DECISIONS.md#d12):
//   - 셀 상태 = useSharedValue (JS state X)
//   - drag = UI thread worklet
//   - drag 종료 시 1회 runOnJS(commit) — 100ms debounce는 caller 책임
//
// 동작:
//   - onBegin: 시작 cell이 baseline에 false였으면 add 모드(toggleAdd=true),
//              true였으면 remove 모드(toggleAdd=false). baseline = selection snapshot.
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
  /**
   * drag begin/end 시 호출. caller가 ScrollView scrollEnabled를 toggle해서
   * sweep 중 부모 ScrollView가 gesture를 가로채는 회귀를 차단 (2026-06-05 Issue 1).
   * runOnJS bridge로 호출되므로 ~16ms overhead. 첫 touch와 첫 movement 사이에 React
   * 재렌더가 끼어들 시간이 보통 있어서 충분히 빠름.
   */
  onDragStateChange?: (active: boolean) => void;
}

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
  const { days, layout, initialSelection, onCommit, onDragStateChange } = options;

  const selection = useSharedValue<Record<SlotKey, boolean>>(initialSelection ?? {});
  const baseline = useSharedValue<Record<SlotKey, boolean>>(initialSelection ?? {});
  const startCoord = useSharedValue<CellCoord | null>(null);
  const currentCoord = useSharedValue<CellCoord | null>(null);
  const toggleAdd = useSharedValue<boolean>(true);
  const scrollOffsetY = useSharedValue<number>(0);

  // jsCommit은 매 render마다 재생성 (days/onCommit closure 캡쳐).
  // panGesture도 매 render마다 재생성 — gesture-handler가 동등성 비교로 처리.
  const jsCommit = (snapshot: Record<SlotKey, boolean>): void => {
    onCommit(selectionToVoteSlots(snapshot, days));
  };

  const jsSetDragActive = (active: boolean): void => {
    if (onDragStateChange) onDragStateChange(active);
  };

  const panGesture = Gesture.Pan()
    .minDistance(0)
    // Issue 1 (2026-06-05): ScrollView가 하향 swipe를 scroll로 가로채는 문제 해소.
    // 1px 이동 시 Pan이 즉시 active 상태가 되어 부모 ScrollView보다 먼저 gesture 점유.
    // ScrollView의 기본 활성 임계값(~10px)보다 작아서 sweep이 항상 우선권.
    .activeOffsetX([-1, 1])
    .activeOffsetY([-1, 1])
    .onBegin((e: { x: number; y: number }) => {
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
      // ScrollView가 가로채지 않게 즉시 비활성화 (Issue 1, 2026-06-05)
      runOnJS(jsSetDragActive)(true);
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
      if (startCoord.value === null) {
        // touch만 있고 drag 미달성한 경우에도 ScrollView 재활성 보장
        runOnJS(jsSetDragActive)(false);
        return;
      }
      startCoord.value = null;
      currentCoord.value = null;
      runOnJS(jsCommit)(selection.value);
      runOnJS(jsSetDragActive)(false);
    })
    .onFinalize(() => {
      // gesture가 cancelled 등으로 끝나도 ScrollView 재활성 (safety net)
      'worklet';
      runOnJS(jsSetDragActive)(false);
    });

  return { panGesture, selection, scrollOffsetY, startCoord, currentCoord, toggleAdd };
}
