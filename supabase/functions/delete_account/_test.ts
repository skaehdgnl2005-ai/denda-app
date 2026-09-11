// delete_account Edge Function — Deno tests (W1-14 회원 탈퇴)
//
// service_role admin.deleteUser + best-effort Google 토큰 revoke.
// 핸들러를 deps 주입형으로 검증 — 실제 네트워크/Supabase 없이 auth·revoke·delete 경로 커버.
// (click_log는 순수 함수만 검증하지만, 삭제 엔드포인트는 핸들러 경로 자체가 급소라 강화.)
//
// 실행:
//   deno test supabase/functions/delete_account/_test.ts --no-check

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { handleDeleteAccount, type DeleteAccountDeps } from './index.ts';

// ---------------------------------------------------------------------------
// mock helpers
// ---------------------------------------------------------------------------

interface MockOptions {
  getUserResult?: { data: { user: { id: string } | null }; error: unknown };
  tokenRow?: { refresh_token: string } | null;
  deleteError?: unknown;
  revokeThrows?: boolean;
}

interface Calls {
  revokedWith: string[];
  deletedWith: string[];
  tokenQueried: boolean;
}

function makeDeps(opts: MockOptions): { deps: DeleteAccountDeps; calls: Calls } {
  const calls: Calls = { revokedWith: [], deletedWith: [], tokenQueried: false };

  const anonClient = {
    auth: {
      getUser: () =>
        Promise.resolve(
          opts.getUserResult ?? { data: { user: { id: 'user-1' } }, error: null },
        ),
    },
  };

  // chainable: from().select().eq().eq().maybeSingle()
  const serviceClient = {
    from: (_table: string) => {
      const chain = {
        select: (_cols: string) => chain,
        eq: (_k: string, _v: string) => chain,
        maybeSingle: () => {
          calls.tokenQueried = true;
          return Promise.resolve({ data: opts.tokenRow ?? null, error: null });
        },
      };
      return chain;
    },
    auth: {
      admin: {
        deleteUser: (id: string) => {
          calls.deletedWith.push(id);
          return Promise.resolve({ data: null, error: opts.deleteError ?? null });
        },
      },
    },
  };

  const deps: DeleteAccountDeps = {
    getAnonClient: () => anonClient as never,
    getServiceRoleClient: () => serviceClient as never,
    revokeGoogleToken: (token: string) => {
      calls.revokedWith.push(token);
      if (opts.revokeThrows) return Promise.reject(new Error('revoke boom'));
      return Promise.resolve();
    },
  };

  return { deps, calls };
}

function postReq(auth: string | null = 'Bearer test-jwt'): Request {
  const headers = new Headers();
  if (auth) headers.set('Authorization', auth);
  return new Request('http://localhost/delete_account', { method: 'POST', headers });
}

async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// method / preflight
// ---------------------------------------------------------------------------

Deno.test('OPTIONS preflight → 200 (인증 불필요)', async () => {
  const { deps } = makeDeps({});
  const res = await handleDeleteAccount(
    new Request('http://localhost', { method: 'OPTIONS' }),
    deps,
  );
  assertEquals(res.status, 200);
});

Deno.test('POST 아니면 → 405', async () => {
  const { deps } = makeDeps({});
  const res = await handleDeleteAccount(
    new Request('http://localhost', { method: 'GET' }),
    deps,
  );
  assertEquals(res.status, 405);
});

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

Deno.test('Authorization 헤더 없음 → 401, 삭제 안 함', async () => {
  const { deps, calls } = makeDeps({});
  const res = await handleDeleteAccount(postReq(null), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.deletedWith.length, 0);
});

Deno.test('getUser 실패(만료 JWT) → 401, 삭제 안 함', async () => {
  const { deps, calls } = makeDeps({
    getUserResult: { data: { user: null }, error: { message: 'jwt expired' } },
  });
  const res = await handleDeleteAccount(postReq(), deps);
  assertEquals(res.status, 401);
  assertEquals(calls.deletedWith.length, 0);
});

// ---------------------------------------------------------------------------
// revoke + delete
// ---------------------------------------------------------------------------

Deno.test('Google 토큰 있으면 revoke 후 본인만 삭제 → 200 {ok:true}', async () => {
  const { deps, calls } = makeDeps({ tokenRow: { refresh_token: 'rt-abc' } });
  const res = await handleDeleteAccount(postReq(), deps);
  assertEquals(res.status, 200);
  assertEquals((await bodyOf(res)).ok, true);
  assertEquals(calls.revokedWith, ['rt-abc']);
  assertEquals(calls.deletedWith, ['user-1']); // JWT에서 도출한 user_id만
});

Deno.test('Google 토큰 없으면 revoke 건너뛰고 삭제 → 200', async () => {
  const { deps, calls } = makeDeps({ tokenRow: null });
  const res = await handleDeleteAccount(postReq(), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.tokenQueried, true);
  assertEquals(calls.revokedWith.length, 0);
  assertEquals(calls.deletedWith, ['user-1']);
});

Deno.test('revoke 실패해도 삭제 진행(non-blocking) → 200', async () => {
  const { deps, calls } = makeDeps({
    tokenRow: { refresh_token: 'rt-x' },
    revokeThrows: true,
  });
  const res = await handleDeleteAccount(postReq(), deps);
  assertEquals(res.status, 200);
  assertEquals(calls.deletedWith, ['user-1']);
});

Deno.test('admin.deleteUser 실패 → 500', async () => {
  const { deps } = makeDeps({ deleteError: { message: 'boom' } });
  const res = await handleDeleteAccount(postReq(), deps);
  assertEquals(res.status, 500);
});
