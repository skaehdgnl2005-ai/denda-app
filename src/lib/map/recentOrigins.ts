// S-MAP M3 — 최근 출발지 온디바이스 로컬 저장 (Q-B23).
//
// 출발지는 서버 미전송(PIPA 경량) — 기기 로컬에만 보관한다. 저장소는 DI(getItemAsync/
// setItemAsync) — 프로덕션은 expo-secure-store 어댑터(recentOriginsStorage.ts), 테스트는
// in-memory fake. 상위 2개만 MRU(최근 사용 순)로 유지해 입력창 빠른 선택 칩에 쓴다.

import { isValidWgs84 } from '@/lib/coords/normalize';

import type { OriginPoint } from './midpoint';

export const RECENT_ORIGINS_KEY = 'denda.map.recent_origins';
export const MAX_RECENT_ORIGINS = 2;

/** 최소 key-value 비동기 저장소 (expo-secure-store 호환 subset). */
export interface RecentOriginsStorage {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

function isOriginPoint(v: unknown): v is OriginPoint {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  if (typeof o.label !== 'string') return false;
  const coord = o.coord as Record<string, unknown> | undefined;
  if (typeof coord !== 'object' || coord === null) return false;
  return (
    typeof coord.lat === 'number' &&
    typeof coord.lng === 'number' &&
    isValidWgs84(coord.lat, coord.lng)
  );
}

/** 새 출발지를 맨 앞에 + 같은 좌표 중복 제거 + 상위 max개로 제한 (MRU). 순수. */
export function mergeRecent(
  existing: OriginPoint[],
  origin: OriginPoint,
  max: number = MAX_RECENT_ORIGINS,
): OriginPoint[] {
  const key = `${origin.coord.lat},${origin.coord.lng}`;
  const deduped = existing.filter((o) => `${o.coord.lat},${o.coord.lng}` !== key);
  return [origin, ...deduped].slice(0, max);
}

/** 저장된 최근 출발지 로드. 미저장·깨진 JSON·잘못된 항목은 안전하게 걸러 빈/유효 배열만 반환. */
export async function loadRecentOrigins(storage: RecentOriginsStorage): Promise<OriginPoint[]> {
  try {
    const raw = await storage.getItemAsync(RECENT_ORIGINS_KEY);
    if (raw === null || raw.length === 0) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isOriginPoint).slice(0, MAX_RECENT_ORIGINS);
  } catch {
    return [];
  }
}

/** 출발지를 최근 목록에 반영(MRU·상위 2개) + 영속 + merged 반환. */
export async function saveRecentOrigin(
  storage: RecentOriginsStorage,
  origin: OriginPoint,
): Promise<OriginPoint[]> {
  const existing = await loadRecentOrigins(storage);
  const merged = mergeRecent(existing, origin);
  await storage.setItemAsync(RECENT_ORIGINS_KEY, JSON.stringify(merged));
  return merged;
}
