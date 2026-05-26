// useHeatmapSubscription — D11 Realtime heatmap broadcast subscribe hook.
//
// 동작:
//   - mount 시 `group:${groupId}` channel 구독
//   - 'heatmap_update' broadcast 수신 → applyHeatmapPayload로 cells 재계산
//   - selfMarks·maxCount 변경 시 즉시 reflow (마지막 payload 재적용)
//   - channel status로 connection state 추적 (RealtimeStatus 칩 — DESIGN §11.4)
//     - SUBSCRIBED → connected
//     - CHANNEL_ERROR / TIMED_OUT / CLOSED → disconnected (30s 후 polling)
//     - DESIGN §11.4 "실시간 갱신 일시 중단 — 30s 후 폴링" 전이 inline state machine
//   - unmount 또는 groupId 변경 시 channel removeChannel + timer clear
//
// 본 hook은 React state 기반. Reanimated `useSharedValue` 통합은 Grid worklet drag
// sub-task에서 별도 wrapping (D12 본문 — drag 셀 상태는 sharedValue, broadcast 결과는
// 별도 channel로 분리).

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase/client';
import { applyHeatmapPayload, type HeatmapPayload } from './applyPayload';
import type { CellState, SlotKey } from './types';

const ROW_COUNT = 60;
const DEFAULT_DISCONNECT_TIMEOUT_MS = 30000; // DESIGN §11.4

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'polling';

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
  /** disconnected → polling 자동 전이 타임아웃 (기본 30s, DESIGN §11.4) */
  disconnectTimeoutMs?: number;
}

export interface UseHeatmapSubscriptionResult {
  cells: CellState[][];
  status: ConnectionStatus;
  isConnected: boolean;
}

const EMPTY_PAYLOAD: HeatmapPayload = { slots: [], updated_at: '' };

export function useHeatmapSubscription({
  groupId,
  selfMarks,
  maxCount,
  dayCount = 7,
  disconnectTimeoutMs = DEFAULT_DISCONNECT_TIMEOUT_MS,
}: UseHeatmapSubscriptionOptions): UseHeatmapSubscriptionResult {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [payload, setPayload] = useState<HeatmapPayload>(EMPTY_PAYLOAD);

  const statusRef = useRef<ConnectionStatus>('connecting');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cells = useMemo(
    () => applyHeatmapPayload(makeEmptyCells(dayCount), payload, selfMarks, maxCount, dayCount),
    [payload, selfMarks, maxCount, dayCount],
  );

  useEffect(() => {
    if (!groupId) return;

    const clearDisconnectTimer = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const transition = (next: ConnectionStatus): void => {
      if (next === statusRef.current) return;
      statusRef.current = next;
      setStatus(next);

      if (next === 'disconnected') {
        clearDisconnectTimer();
        timerRef.current = setTimeout(() => {
          // disconnected 상태일 때만 polling 진입 (stale timer 안전)
          if (statusRef.current === 'disconnected') {
            statusRef.current = 'polling';
            setStatus('polling');
          }
          timerRef.current = null;
        }, disconnectTimeoutMs);
      } else {
        // connected / polling / connecting → timer 불필요
        clearDisconnectTimer();
      }
    };

    const channel = supabase.channel(`group:${groupId}`);

    channel.on(
      'broadcast',
      { event: 'heatmap_update' },
      ({ payload: next }: { event: string; payload: HeatmapPayload }) => {
        setPayload(next);
      },
    );

    channel.subscribe((raw: string) => {
      if (raw === 'SUBSCRIBED') {
        transition('connected');
      } else if (raw === 'CHANNEL_ERROR' || raw === 'TIMED_OUT' || raw === 'CLOSED') {
        // polling 상태에서는 downgrade 안 함 (이미 fallback 중)
        if (statusRef.current !== 'polling') {
          transition('disconnected');
        }
      }
    });

    return (): void => {
      clearDisconnectTimer();
      statusRef.current = 'connecting';
      setStatus('connecting');
      setPayload(EMPTY_PAYLOAD);
      supabase.removeChannel(channel);
    };
  }, [groupId, disconnectTimeoutMs]);

  return { cells, status, isConnected: status === 'connected' };
}
