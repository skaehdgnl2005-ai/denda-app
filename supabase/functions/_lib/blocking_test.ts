// blocking_test.ts — D16 is_blocked RPC wrapper unit tests
// 실행: deno test --allow-env supabase/functions/_lib/blocking_test.ts
//
// Note: Mock SupabaseClient의 .rpc() 호출만 검증.
//       실제 DB integration은 Supabase local 환경 또는 e2e에서 별도 검증.

import { assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isBlocked } from './blocking.ts';

// 최소 mock — .rpc(name, params) → { data, error }
interface RpcCall {
  fn: string;
  params: Record<string, unknown>;
}

function makeMockClient(result: { data: unknown; error: unknown }): {
  client: { rpc: (fn: string, params: Record<string, unknown>) => Promise<typeof result> };
  calls: RpcCall[];
} {
  const calls: RpcCall[] = [];
  return {
    client: {
      rpc: (fn: string, params: Record<string, unknown>) => {
        calls.push({ fn, params });
        return Promise.resolve(result);
      },
    },
    calls,
  };
}

const VIEWER = '11111111-1111-1111-1111-111111111111';
const TARGET = '22222222-2222-2222-2222-222222222222';

Deno.test('isBlocked: rpc 호출 인자 = { viewer_id, target_id }', async () => {
  const mock = makeMockClient({ data: false, error: null });
  // deno-lint-ignore no-explicit-any
  await isBlocked(mock.client as any, VIEWER, TARGET);
  assertEquals(mock.calls.length, 1);
  assertEquals(mock.calls[0].fn, 'is_blocked');
  assertEquals(mock.calls[0].params, { viewer_id: VIEWER, target_id: TARGET });
});

Deno.test('isBlocked: data === true → return true', async () => {
  const mock = makeMockClient({ data: true, error: null });
  // deno-lint-ignore no-explicit-any
  const result = await isBlocked(mock.client as any, VIEWER, TARGET);
  assertEquals(result, true);
});

Deno.test('isBlocked: data === false → return false', async () => {
  const mock = makeMockClient({ data: false, error: null });
  // deno-lint-ignore no-explicit-any
  const result = await isBlocked(mock.client as any, VIEWER, TARGET);
  assertEquals(result, false);
});

Deno.test('isBlocked: data === null → return false (안전한 default)', async () => {
  const mock = makeMockClient({ data: null, error: null });
  // deno-lint-ignore no-explicit-any
  const result = await isBlocked(mock.client as any, VIEWER, TARGET);
  assertEquals(result, false);
});

Deno.test('isBlocked: rpc error → throw propagation', async () => {
  const mock = makeMockClient({ data: null, error: new Error('rpc failed') });
  await assertRejects(
    // deno-lint-ignore no-explicit-any
    () => isBlocked(mock.client as any, VIEWER, TARGET),
    Error,
    'rpc failed',
  );
});
