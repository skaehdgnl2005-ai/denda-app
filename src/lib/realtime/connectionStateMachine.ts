// S05d — Supabase Realtime 연결 상태 머신 (pure).
//
// 라이프사이클:
//   connecting → connected → disconnected → polling
//                  ↑__________recovery (subscribed)__________↓
//
// 30s disconnect timeout은 hook(useRealtimeStatus)이 관리.
// 머신은 disconnect_timeout event를 받으면 → polling으로 전이.

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'polling';

export type ConnectionEvent =
  | { type: 'subscribed' }
  | { type: 'error' }
  | { type: 'timeout' }
  | { type: 'closed' }
  | { type: 'disconnect_timeout' };

export const initialConnectionState: ConnectionState = 'connecting';

export function reduceConnectionState(
  state: ConnectionState,
  event: ConnectionEvent,
): ConnectionState {
  switch (event.type) {
    case 'subscribed':
      return 'connected';
    case 'error':
    case 'timeout':
    case 'closed':
      // 이미 polling이면 유지 (downgrade 안 함)
      return state === 'polling' ? 'polling' : 'disconnected';
    case 'disconnect_timeout':
      // disconnected 상태일 때만 polling으로 진입
      return state === 'disconnected' ? 'polling' : state;
    default:
      return state;
  }
}
