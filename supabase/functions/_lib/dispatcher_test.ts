// dispatcher — D33 (Q-B5 close) Deno tests
//
// 실행:
//   cd supabase && deno test functions/_lib/dispatcher_test.ts --no-check
//
// `_lib/dispatcher.ts`는 모듈 단위 singleton state(handlers Record)를 가지므로
// 각 테스트 시작 전 `clearHandlers()`로 reset 의무. dispatcher가 group_confirm 등
// publisher가 사용하는 in-process EventBus이므로 cross-test 누수 시 false-positive.

import {
  assertEquals,
  assert,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  clearHandlers,
  dispatch,
  listHandlers,
  register,
  type DispatchEvent,
} from './dispatcher.ts';

// 모든 테스트 격리 — singleton state가 누수되지 않도록 매 테스트 reset
function reset(): void {
  clearHandlers();
}

// ---------------------------------------------------------------------------
// Test 1: register → dispatch → handler 호출
// ---------------------------------------------------------------------------
Deno.test('register + dispatch — handler가 정확한 event payload로 호출됨', async () => {
  reset();

  const received: DispatchEvent[] = [];
  register('group_confirmed', async (event) => {
    received.push(event);
  });

  const event: DispatchEvent = {
    type: 'group_confirmed',
    groupId: 'g-1',
    hostId: 'h-1',
    confirmedAt: '2026-05-26T10:00:00+09:00',
  };
  await dispatch(event);

  assertEquals(received.length, 1);
  assertEquals(received[0], event);
});

// ---------------------------------------------------------------------------
// Test 2: 같은 type 여러 handler — 모두 호출 (등록 순서대로 시작)
// ---------------------------------------------------------------------------
Deno.test('dispatch — 같은 type의 모든 handler 호출', async () => {
  reset();

  const callOrder: string[] = [];
  register('group_confirmed', async () => {
    callOrder.push('a');
  });
  register('group_confirmed', async () => {
    callOrder.push('b');
  });
  register('group_confirmed', async () => {
    callOrder.push('c');
  });

  await dispatch({
    type: 'group_confirmed',
    groupId: 'g-1',
    hostId: 'h-1',
    confirmedAt: '2026-05-26T10:00:00+09:00',
  });

  // 등록된 모든 handler가 호출됨 (Promise.allSettled로 순서 보장은 안 하지만 3개 모두 실행)
  assertEquals(callOrder.length, 3);
  assertEquals(new Set(callOrder), new Set(['a', 'b', 'c']));
});

// ---------------------------------------------------------------------------
// Test 3: handler throw — 다른 handler가 계속 진행 (Promise.allSettled 격리)
// ---------------------------------------------------------------------------
Deno.test('dispatch — handler 실패가 다른 handler 차단 X (격리)', async () => {
  reset();

  const successful: string[] = [];
  register('group_confirmed', async () => {
    throw new Error('handler 1 실패');
  });
  register('group_confirmed', async () => {
    successful.push('handler 2');
  });
  register('group_confirmed', async () => {
    throw new Error('handler 3 실패');
  });
  register('group_confirmed', async () => {
    successful.push('handler 4');
  });

  // dispatch 자체는 throw 안 함 (Promise.allSettled)
  const result = await dispatch({
    type: 'group_confirmed',
    groupId: 'g-1',
    hostId: 'h-1',
    confirmedAt: '2026-05-26T10:00:00+09:00',
  });

  // 성공한 handler 2개 모두 실행
  assertEquals(new Set(successful), new Set(['handler 2', 'handler 4']));

  // dispatch 결과 — 실패한 handler 정보 보고
  assertExists(result);
  assertEquals(result.length, 4);
  const rejected = result.filter((r) => r.status === 'rejected');
  const fulfilled = result.filter((r) => r.status === 'fulfilled');
  assertEquals(rejected.length, 2);
  assertEquals(fulfilled.length, 2);
});

// ---------------------------------------------------------------------------
// Test 4: handler 없는 type dispatch — no-op (throw X)
// ---------------------------------------------------------------------------
Deno.test('dispatch — handler 없는 type는 no-op', async () => {
  reset();

  // 아무 handler도 등록 안 함
  const result = await dispatch({
    type: 'group_confirmed',
    groupId: 'g-1',
    hostId: 'h-1',
    confirmedAt: '2026-05-26T10:00:00+09:00',
  });

  assertEquals(result.length, 0);
});

// ---------------------------------------------------------------------------
// Test 5: clearHandlers — singleton state reset (테스트 격리)
// ---------------------------------------------------------------------------
Deno.test('clearHandlers — 등록된 handler 전체 제거', async () => {
  reset();

  register('group_confirmed', async () => {});
  register('group_confirmed', async () => {});
  register('friend_requested', async () => {});

  assertEquals(listHandlers('group_confirmed').length, 2);
  assertEquals(listHandlers('friend_requested').length, 1);

  clearHandlers();

  assertEquals(listHandlers('group_confirmed').length, 0);
  assertEquals(listHandlers('friend_requested').length, 0);
});

// ---------------------------------------------------------------------------
// Test 6: clearHandlers(type) — 특정 type만 제거
// ---------------------------------------------------------------------------
Deno.test('clearHandlers(type) — 특정 type만 제거', async () => {
  reset();

  register('group_confirmed', async () => {});
  register('group_confirmed', async () => {});
  register('friend_requested', async () => {});

  clearHandlers('group_confirmed');

  assertEquals(listHandlers('group_confirmed').length, 0);
  assertEquals(listHandlers('friend_requested').length, 1);
});

// ---------------------------------------------------------------------------
// Test 7: 다른 event type — 등록된 type만 매칭
// ---------------------------------------------------------------------------
Deno.test('dispatch — event.type이 다른 type handler는 호출 X', async () => {
  reset();

  let groupConfirmedCalled = 0;
  let friendRequestedCalled = 0;

  register('group_confirmed', async () => {
    groupConfirmedCalled++;
  });
  register('friend_requested', async () => {
    friendRequestedCalled++;
  });

  await dispatch({
    type: 'group_confirmed',
    groupId: 'g-1',
    hostId: 'h-1',
    confirmedAt: '2026-05-26T10:00:00+09:00',
  });

  assertEquals(groupConfirmedCalled, 1);
  assertEquals(friendRequestedCalled, 0);

  await dispatch({
    type: 'friend_requested',
    fromUserId: 'u-1',
    toUserId: 'u-2',
  });

  assertEquals(groupConfirmedCalled, 1);
  assertEquals(friendRequestedCalled, 1);
});

// ---------------------------------------------------------------------------
// Test 8: handler가 sync error — Promise.allSettled가 동일하게 격리
// ---------------------------------------------------------------------------
Deno.test('dispatch — sync throw도 다른 handler 차단 X', async () => {
  reset();

  const calls: string[] = [];
  register('votes_all_in', () => {
    // sync throw (async wrapping 안 함)
    throw new Error('sync 실패');
  });
  register('votes_all_in', async () => {
    calls.push('async 성공');
  });

  const result = await dispatch({ type: 'votes_all_in', groupId: 'g-1' });

  assertEquals(calls, ['async 성공']);
  assertEquals(result.length, 2);
  assert(result.some((r) => r.status === 'rejected'));
  assert(result.some((r) => r.status === 'fulfilled'));
});
