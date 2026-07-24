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
const DEFAULT_POLL_INTERVAL_MS = 15000;

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
  /** polling 상태의 주기 fetch 간격 (기본 15s) */
  pollIntervalMs?: number;
  /**
   * 서버 집계 스냅샷 요청 (D11 — 클라 합산 금지, votes_aggregate Edge가 합산).
   * 연결 시 1회 + polling 주기마다 호출. null이면 무시. 기본 구현은 votes_aggregate invoke.
   * 이 배선이 없으면 진입 시 다음 투표 broadcast 전까지 타인 투표가 전부 빈 그리드다.
   */
  requestSnapshot?: () => Promise<HeatmapPayload | null>;
}

export interface UseHeatmapSubscriptionResult {
  cells: CellState[][];
  status: ConnectionStatus;
  isConnected: boolean;
}

const EMPTY_PAYLOAD: HeatmapPayload = { slots: [], updated_at: '' };

/**
 * 기본 스냅샷 요청 — votes_aggregate Edge Function invoke (서버 합산, D11 준수).
 * 응답의 payload를 그대로 적용. 실패·미배포·mock 환경은 null (broadcast 경로로 계속).
 */
async function invokeAggregateSnapshot(groupId: string): Promise<HeatmapPayload | null> {
  try {
    const fns = (supabase as { functions?: { invoke?: Function } }).functions;
    if (!fns?.invoke) return null;
    const { data, error } = (await fns.invoke('votes_aggregate', {
      body: { group_id: groupId },
    })) as { data: { payload?: HeatmapPayload } | null; error: unknown };
    if (error !== null || !data?.payload) return null;
    return data.payload;
  } catch {
    return null; // best-effort — 실패해도 broadcast 수신은 정상 동작
  }
}

export function useHeatmapSubscription({
  groupId,
  selfMarks,
  maxCount,
  dayCount = 7,
  disconnectTimeoutMs = DEFAULT_DISCONNECT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  requestSnapshot,
}: UseHeatmapSubscriptionOptions): UseHeatmapSubscriptionResult {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [payload, setPayload] = useState<HeatmapPayload>(EMPTY_PAYLOAD);

  const statusRef = useRef<ConnectionStatus>('connecting');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // requestSnapshot 함수 identity 변화가 channel 재구독을 유발하지 않도록 ref 경유
  const requestSnapshotRef = useRef(requestSnapshot);
  requestSnapshotRef.current = requestSnapshot;

  const cells = useMemo(
    () => applyHeatmapPayload(makeEmptyCells(dayCount), payload, selfMarks, maxCount, dayCount),
    [payload, selfMarks, maxCount, dayCount],
  );

  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const fetchSnapshot = (): void => {
      const fn = requestSnapshotRef.current ?? (() => invokeAggregateSnapshot(groupId));
      Promise.resolve()
        .then(() => fn())
        .then((next) => {
          if (!cancelled && next !== null) setPayload(next);
        })
        .catch(() => {
          // best-effort — 실패해도 broadcast 경로가 살아 있다
        });
    };

    const clearDisconnectTimer = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const stopPolling = (): void => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = (): void => {
      stopPolling();
      fetchSnapshot(); // 진입 즉시 1회 — 30s 단절 동안의 변경을 곧바로 복구
      pollTimer = setInterval(fetchSnapshot, pollIntervalMs);
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
            startPolling();
          }
          timerRef.current = null;
        }, disconnectTimeoutMs);
      } else {
        // connected / polling / connecting → timer 불필요
        clearDisconnectTimer();
      }
      if (next !== 'polling') {
        stopPolling();
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
        // 초기/재연결 스냅샷 — 이 요청이 없으면 다음 투표 broadcast 전까지
        // 타인 투표가 전부 빈 그리드로 보인다 (C1)
        fetchSnapshot();
      } else if (raw === 'CHANNEL_ERROR' || raw === 'TIMED_OUT' || raw === 'CLOSED') {
        // polling 상태에서는 downgrade 안 함 (이미 fallback 중)
        if (statusRef.current !== 'polling') {
          transition('disconnected');
        }
      }
    });

    return (): void => {
      cancelled = true;
      clearDisconnectTimer();
      stopPolling();
      statusRef.current = 'connecting';
      setStatus('connecting');
      setPayload(EMPTY_PAYLOAD);
      supabase.removeChannel(channel);
    };
  }, [groupId, disconnectTimeoutMs, pollIntervalMs]);

  return { cells, status, isConnected: status === 'connected' };
}
