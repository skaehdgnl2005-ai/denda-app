// In-process dispatcher — D33 (Q-B5 close)
//
// Edge Function 단일 publisher pattern. `group_confirm` Edge Function이 confirmed_at SET 후
// `dispatch({type:'group_confirmed', ...})` 1회 호출 → 등록된 handler(F5 push / Calendar push
// queue / 그 외) 모두 in-process로 fan-out. DB trigger 분산 listen 금지.
//
// 격리 보장: `Promise.allSettled`로 한 handler 실패가 다른 handler 차단 X.
// 결과는 `PromiseSettledResult[]`로 반환해 publisher가 failure logging/recovery 결정 가능.
//
// Sync throw도 동일하게 격리 — handler 호출을 `Promise.resolve().then(...)`로 wrap해
// sync error도 rejected promise로 변환.
//
// **모듈 단위 singleton state** — handler list가 모듈 import 시점에 셋업되므로,
// Edge Function의 짧은 lifecycle(콜드/웜)에 OK. 테스트에서는 `clearHandlers()`로 reset.

export type DispatchEvent =
  | { type: 'group_confirmed'; groupId: string; hostId: string; confirmedAt: string }
  | { type: 'group_invited'; groupId: string; inviterId: string; inviteeId: string }
  | { type: 'friend_requested'; fromUserId: string; toUserId: string }
  | { type: 'friend_accepted'; fromUserId: string; toUserId: string }
  | { type: 'votes_all_in'; groupId: string };

export type DispatchEventType = DispatchEvent['type'];

export type DispatchHandler = (event: DispatchEvent) => void | Promise<void>;

const handlers: Record<DispatchEventType, DispatchHandler[]> = {
  group_confirmed: [],
  group_invited: [],
  friend_requested: [],
  friend_accepted: [],
  votes_all_in: [],
};

export function register(type: DispatchEventType, handler: DispatchHandler): void {
  handlers[type].push(handler);
}

export function listHandlers(type: DispatchEventType): DispatchHandler[] {
  return [...handlers[type]];
}

export function clearHandlers(type?: DispatchEventType): void {
  if (type) {
    handlers[type] = [];
    return;
  }
  for (const key of Object.keys(handlers) as DispatchEventType[]) {
    handlers[key] = [];
  }
}

/**
 * 등록된 모든 handler를 격리 실행하고 결과를 반환.
 *
 * - sync throw도 rejected promise로 변환 (Promise.resolve().then() wrap)
 * - 한 handler 실패가 다른 handler 차단 X (Promise.allSettled)
 * - publisher는 결과 array에서 rejected만 골라 logging/recovery 결정
 */
export async function dispatch(
  event: DispatchEvent,
): Promise<PromiseSettledResult<void>[]> {
  const list = handlers[event.type] ?? [];
  if (list.length === 0) return [];

  return await Promise.allSettled(
    list.map((h) => Promise.resolve().then(() => h(event))),
  );
}
