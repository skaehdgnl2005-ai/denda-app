// supabase 세션 영속용 SecureStore 어댑터 — expo-secure-store의 2048바이트 값 제한을
// 청크 분할로 우회한다. 이 어댑터가 없으면 persistSession:true여도 RN에는 localStorage가
// 없어 메모리 폴백 → 앱 재시작마다 로그아웃 (P2 버그 헌트 B1).

import { createSecureStorageAdapter, type SecureStoreLike } from './secureStorage';

function makeFakeStore(): SecureStoreLike & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItemAsync: async (k) => map.get(k) ?? null,
    setItemAsync: async (k, v) => {
      map.set(k, v);
    },
    deleteItemAsync: async (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe('createSecureStorageAdapter', () => {
  test('소형 값 roundtrip', async () => {
    const store = makeFakeStore();
    const adapter = createSecureStorageAdapter(store);
    await adapter.setItem('sb-x-auth-token', '{"access_token":"a"}');
    expect(await adapter.getItem('sb-x-auth-token')).toBe('{"access_token":"a"}');
  });

  test('미존재 키 → null', async () => {
    const adapter = createSecureStorageAdapter(makeFakeStore());
    expect(await adapter.getItem('none')).toBeNull();
  });

  test('2048바이트 초과 값 → 청크 분할 저장 + 재조립 (각 청크는 제한 이하)', async () => {
    const store = makeFakeStore();
    const adapter = createSecureStorageAdapter(store);
    const big = 'x'.repeat(5000) + '끝'; // 멀티바이트 경계 포함
    await adapter.setItem('big', big);

    // 각 물리 값이 SecureStore 제한(2048바이트) 이하인지
    for (const [, v] of Object.entries(store.dump())) {
      expect(Buffer.byteLength(v, 'utf8')).toBeLessThanOrEqual(2048);
    }
    expect(await adapter.getItem('big')).toBe(big);
  });

  test('removeItem은 모든 청크를 제거한다', async () => {
    const store = makeFakeStore();
    const adapter = createSecureStorageAdapter(store);
    await adapter.setItem('big', 'y'.repeat(5000));
    await adapter.removeItem('big');
    expect(Object.keys(store.dump())).toHaveLength(0);
    expect(await adapter.getItem('big')).toBeNull();
  });

  test('작은 값으로 덮어쓰면 이전 잉여 청크가 남지 않는다', async () => {
    const store = makeFakeStore();
    const adapter = createSecureStorageAdapter(store);
    await adapter.setItem('k', 'z'.repeat(5000)); // 3+ 청크
    await adapter.setItem('k', 'short'); // 1 청크
    expect(await adapter.getItem('k')).toBe('short');
    // 잉여 청크가 남아 있으면 재조립이 오염된다
    const keys = Object.keys(store.dump());
    expect(keys.filter((k) => k.startsWith('k.chunk.'))).toHaveLength(1);
  });

  test('청크 메타 손상 시 null 반환 (fail-safe — 로그인 화면으로 진행)', async () => {
    const store = makeFakeStore();
    await store.setItemAsync('bad.chunks', 'not-a-number');
    const adapter = createSecureStorageAdapter(store);
    expect(await adapter.getItem('bad')).toBeNull();
  });

  test('SecureStore 키 제약([A-Za-z0-9._-]) 위반 문자를 안전 치환', async () => {
    const store = makeFakeStore();
    const adapter = createSecureStorageAdapter(store);
    // supabase storageKey 자체는 안전하지만, 방어적으로 임의 키도 동작해야 한다
    await adapter.setItem('weird key!', 'v');
    expect(await adapter.getItem('weird key!')).toBe('v');
    for (const k of Object.keys(store.dump())) {
      expect(k).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });
});
