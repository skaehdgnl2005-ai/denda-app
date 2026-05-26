// useHeatmapSubscription — D11 Realtime heatmap broadcast subscribe hook.
//
// 동작:
//   - mount 시 `group:${groupId}` channel 구독
//   - 'heatmap_update' broadcast 수신 → applyHeatmapPayload로 cells 재계산
//   - selfMarks·maxCount 변경 시도 즉시 reflow (마지막 payload 재적용)
//   - channel status로 isConnected 추적 (RealtimeStatus 칩 — DESIGN §11.4)
//   - unmount 또는 groupId 변경 시 channel removeChannel
//
// 본 hook은 React state 기반. Reanimated `useSharedValue` 통합은 Grid worklet drag
// sub-task에서 별도 wrapping (D12 본문 — drag 셀 상태는 sharedValue, broadcast 결과는
// 별도 channel로 분리).

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/client';
import { applyHeatmapPayload, type HeatmapPayload } from './applyPayload';
import type { CellState, SlotKey } from './types';

const ROW_COUNT = 60;

function makeEmptyCells(dayCount: number): CellState[][] {
  return Array.from({ length: ROW_COUNT }, () =>
    Array.from({ length: dayCount }, () => ({ state: 'heat-0' as const, count: 0 })),
  );
}

export interface UseHeatmapSubscriptionOptions {
  groupId: string;
  selfMarks: Set<SlotKey>;
  maxCount: number;
  dayCount?: number;
}

export interface UseHeatmapSubscriptionResult {
  cells: CellState[][];
  isConnected: boolean;
}

const EMPTY_PAYLOAD: HeatmapPayload = { slots: [], updated_at: '' };

export function useHeatmapSubscription({
  groupId,
  selfMarks,
  maxCount,
  dayCount = 7,
}: UseHeatmapSubscriptionOptions): UseHeatmapSubscriptionResult {
  const [isConnected, setIsConnected] = useState(false);
  const [payload, setPayload] = useState<HeatmapPayload>(EMPTY_PAYLOAD);

  const cells = useMemo(
    () => applyHeatmapPayload(makeEmptyCells(dayCount), payload, selfMarks, maxCount, dayCount),
    [payload, selfMarks, maxCount, dayCount],
  );

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase.channel(`group:${groupId}`);

    channel.on(
      'broadcast',
      { event: 'heatmap_update' },
      ({ payload: next }: { event: string; payload: HeatmapPayload }) => {
        setPayload(next);
      },
    );

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setIsConnected(false);
      }
    });

    return (): void => {
      setIsConnected(false);
      setPayload(EMPTY_PAYLOAD);
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  return { cells, isConnected };
}
