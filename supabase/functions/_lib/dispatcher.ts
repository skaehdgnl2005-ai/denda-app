// 단일 dispatcher pattern stub — Q-B5 결정 대기
// Calendar push(S06) + Push 알림(S12)이 둘 다 "모임 확정" trigger를 듣지 않도록.
// 현재는 stub. Q-B5 closure 후 EventBus 또는 pg_cron + queue로 확장.

export type DispatchEvent =
  | { type: 'group_confirmed'; groupId: string; hostId: string; confirmedAt: string }
  | { type: 'group_invited'; groupId: string; inviterId: string; inviteeId: string }
  | { type: 'friend_requested'; fromUserId: string; toUserId: string }
  | { type: 'friend_accepted'; fromUserId: string; toUserId: string }
  | { type: 'votes_all_in'; groupId: string };

export type DispatchHandler = (event: DispatchEvent) => Promise<void>;

const handlers: Record<DispatchEvent['type'], DispatchHandler[]> = {
  group_confirmed: [],
  group_invited: [],
  friend_requested: [],
  friend_accepted: [],
  votes_all_in: [],
};

export function register(type: DispatchEvent['type'], handler: DispatchHandler): void {
  handlers[type].push(handler);
}

export async function dispatch(event: DispatchEvent): Promise<void> {
  const list = handlers[event.type] ?? [];
  await Promise.allSettled(list.map((h) => h(event)));
}
