// S05d — Supabase Realtime 연결 상태 hook.
//
// 사용:
//   const { status, isConnected, channel } = useRealtimeStatus({
//     client: supabase,
//     channelName: `group:${groupId}`,
//   });
//   useEffect(() => {
//     if (!channel) return;
//     channel.on('broadcast', { event: 'heatmap_update' }, ({ payload }) => {...});
//   }, [channel]);
//
// isConnected=false일 때 <RealtimeStatus> chip이 렌더 → DESIGN §11.4 "실시간 갱신 일시 중단".

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  initialConnectionState,
  reduceConnectionState,
  type ConnectionState,
  type ConnectionEvent,
} from './connectionStateMachine';

// supabase-js 의존을 type-level로만 (테스트 mock 위해 generic):
interface RealtimeChannelLike {
  on(...args: unknown[]): RealtimeChannelLike;
  subscribe(callback: (status: string, err?: Error) => void): RealtimeChannelLike;
  unsubscribe(): Promise<unknown> | unknown;
}
interface SupabaseLike {
  channel(name: string): RealtimeChannelLike;
}

export interface UseRealtimeStatusOptions {
  client: SupabaseLike;
  channelName: string;
  /** disconnected → polling 자동 전이 타임아웃 (기본 30s, DESIGN §11.4) */
  disconnectTimeoutMs?: number;
}

export interface UseRealtimeStatusResult {
  status: ConnectionState;
  isConnected: boolean;
  channel: RealtimeChannelLike | null;
}

function mapStatusToEvent(status: string): ConnectionEvent | null {
  switch (status) {
    case 'SUBSCRIBED':
      return { type: 'subscribed' };
    case 'CHANNEL_ERROR':
      return { type: 'error' };
    case 'TIMED_OUT':
      return { type: 'timeout' };
    case 'CLOSED':
      return { type: 'closed' };
    default:
      return null;
  }
}

export function useRealtimeStatus(options: UseRealtimeStatusOptions): UseRealtimeStatusResult {
  const { client, channelName, disconnectTimeoutMs = 30000 } = options;
  const [status, setStatus] = useState<ConnectionState>(initialConnectionState);

  const channel = useMemo<RealtimeChannelLike>(
    () => client.channel(channelName),
    [client, channelName],
  );

  const statusRef = useRef<ConnectionState>(initialConnectionState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const clearDisconnectTimer = (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const dispatch = (event: ConnectionEvent): void => {
      if (!mountedRef.current) return;
      const next = reduceConnectionState(statusRef.current, event);
      if (next === statusRef.current) return;
      statusRef.current = next;
      setStatus(next);

      if (next === 'disconnected') {
        clearDisconnectTimer();
        timerRef.current = setTimeout(() => {
          dispatch({ type: 'disconnect_timeout' });
        }, disconnectTimeoutMs);
      } else {
        clearDisconnectTimer();
      }
    };

    channel.subscribe((raw) => {
      const event = mapStatusToEvent(raw);
      if (event !== null) dispatch(event);
    });

    return (): void => {
      mountedRef.current = false;
      clearDisconnectTimer();
      channel.unsubscribe();
    };
  }, [channel, disconnectTimeoutMs]);

  return {
    status,
    isConnected: status === 'connected',
    channel,
  };
}
