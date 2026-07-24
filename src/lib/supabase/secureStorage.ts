// supabase-js 세션 영속용 SecureStore 어댑터.
//
// 배경 (P2 버그 헌트 B1): RN에는 localStorage가 없어 persistSession:true여도 supabase-js가
// 메모리 폴백 → 앱 재시작마다 세션 소실(매번 재로그인). authStore.ts 헤더가 가정하던
// "storage adapter 주입"이 실제로는 없었다 — 본 파일이 그 계약을 이행한다.
//
// expo-secure-store는 값당 2048바이트 제한(초과 시 경고, 장차 에러 예고)이 있는데
// supabase 세션 JSON(JWT + user_metadata)은 이를 쉽게 넘는다 → 1900바이트 청크로
// 분할 저장하고 getItem에서 재조립한다.
//
// 물리 키 구조: `${key}.chunks` = 청크 수, `${key}.chunk.${i}` = i번째 조각.
// SecureStore 키 제약([A-Za-z0-9._-])에 맞춰 위반 문자는 '_'로 치환.

export type SecureStoreLike = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};

// supabase-js v2 auth.storage가 요구하는 shape (SupportedStorage — async 허용)
export type SupabaseStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// UTF-8 멀티바이트(한글 3바이트)를 감안해 2048 제한보다 낮게 잡는다.
// slice는 UTF-16 코드유닛 기준이라 최악(전부 3바이트 문자)에도 600*3=1800 < 2048.
const CHUNK_CHARS = 600;

function sanitizeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export function createSecureStorageAdapter(store: SecureStoreLike): SupabaseStorageAdapter {
  const countKey = (key: string): string => `${sanitizeKey(key)}.chunks`;
  const chunkKey = (key: string, i: number): string => `${sanitizeKey(key)}.chunk.${i}`;

  return {
    async getItem(key: string): Promise<string | null> {
      const rawCount = await store.getItemAsync(countKey(key));
      if (rawCount === null) return null;
      const count = Number(rawCount);
      if (!Number.isInteger(count) || count <= 0) return null; // 메타 손상 — fail-safe
      const chunks: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const chunk = await store.getItemAsync(chunkKey(key, i));
        if (chunk === null) return null; // 조각 유실 — 부분 세션보다 재로그인이 안전
        chunks.push(chunk);
      }
      return chunks.join('');
    },

    async setItem(key: string, value: string): Promise<void> {
      const prevRaw = await store.getItemAsync(countKey(key));
      const prevCount = prevRaw !== null ? Number(prevRaw) : 0;

      const count = Math.max(1, Math.ceil(value.length / CHUNK_CHARS));
      for (let i = 0; i < count; i += 1) {
        await store.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS));
      }
      await store.setItemAsync(countKey(key), String(count));

      // 이전 값이 더 길었다면 잉여 청크 제거 (남으면 재조립 오염은 없지만 쓰레기 누적)
      if (Number.isInteger(prevCount)) {
        for (let i = count; i < prevCount; i += 1) {
          await store.deleteItemAsync(chunkKey(key, i));
        }
      }
    },

    async removeItem(key: string): Promise<void> {
      const rawCount = await store.getItemAsync(countKey(key));
      const count = rawCount !== null ? Number(rawCount) : 0;
      await store.deleteItemAsync(countKey(key));
      if (Number.isInteger(count)) {
        for (let i = 0; i < count; i += 1) {
          await store.deleteItemAsync(chunkKey(key, i));
        }
      }
    },
  };
}
