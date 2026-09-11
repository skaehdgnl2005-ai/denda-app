# S-MAP M5 — 중간지점 협업 업그레이드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모임 멤버 각자가 출발지를 등록하면(서버 저장+RLS) 가까운 지하철역으로 스냅한 "대략적 중간지점"과 그 역 기준 장소를 검색어 입력 없이 자동 추천한다.

**Architecture:** `group_origins` 테이블(1인 1출발지, RLS) + 정적 지하철역 데이터 + 순수 함수 `nearestStation`/`buildAutoQuery` → 기존 `useMapSearch`·`MapHost`·`usePlaceConfirmAction` 스택에 그대로 연결. 신규 Edge Function 0, 신규 외부 API 0.

**Tech Stack:** React Native(Expo)·TypeScript strict·Supabase(PostgREST+RLS)·luxon·Jest+@testing-library/react-native

**Spec:** [docs/superpowers/specs/2026-07-12-midpoint-collab-design.md](../specs/2026-07-12-midpoint-collab-design.md)

## Global Constraints

- 모든 UI 라벨·에러 메시지는 **한국어** (rules/ko-kr.md)
- 시각 값은 **DESIGN 토큰만** (`useTheme()`의 colors/space/radius — hex·임의 px 금지, design-guard hook이 차단)
- **`new Date()` 직접 사용 금지** — luxon `DateTime.utc()` 사용 (D13)
- TypeScript strict · `any` 금지 · 모든 함수 명시적 return type · props interface
- **TDD**: 각 태스크는 테스트 먼저 → 실패 확인 → 구현 → 통과 → 커밋
- 테스트 실행: `npm test -- <파일경로>` (Jest). 전체: `npm test`
- RLS 정책에 self-EXISTS 금지 — 0022 SECURITY DEFINER 헬퍼(`is_group_member`/`is_group_host`)만 사용
- Gate #1·#2 로깅(usePlaceConfirmAction·click_log)·MapHost/NaverMapScene·D12 워클릿 **수정 금지**
- import 경로 별칭: `@/` = `src/`

---

### Task 1: `stationSnap` — 최근접 역 순수 함수

**Files:**
- Create: `src/lib/map/stationSnap.ts`
- Test: `src/lib/map/stationSnap.test.ts`

**Interfaces:**
- Consumes: `haversineMeters(a, b)` (`@/lib/coords/distance`), `Wgs84Coord` (`@/lib/coords/normalize`)
- Produces: `interface SubwayStation { name: string; lat: number; lng: number }` · `interface StationSnap { name: string; coord: Wgs84Coord; distanceMeters: number }` · `STATION_SNAP_MAX_METERS = 3000` · `nearestStation(coord: Wgs84Coord, stations: readonly SubwayStation[]): StationSnap | null` — Task 3의 데이터 파일이 `SubwayStation` 타입을 import하고, Task 8의 화면이 `nearestStation(midpoint, SUBWAY_STATIONS)`로 호출한다.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/map/stationSnap.test.ts
import { nearestStation, STATION_SNAP_MAX_METERS, type SubwayStation } from './stationSnap';

const STATIONS: SubwayStation[] = [
  { name: '강남역', lat: 37.4979, lng: 127.0276 },
  { name: '홍대입구역', lat: 37.5572, lng: 126.9245 },
  { name: '공덕역', lat: 37.5432, lng: 126.9512 },
];

describe('nearestStation', () => {
  test('가장 가까운 역을 반환한다 (공덕 근처 좌표 → 공덕역)', () => {
    const snap = nearestStation({ lat: 37.544, lng: 126.952 }, STATIONS);
    expect(snap).not.toBeNull();
    expect(snap?.name).toBe('공덕역');
    expect(snap?.coord).toEqual({ lat: 37.5432, lng: 126.9512 });
    expect(snap?.distanceMeters).toBeGreaterThan(0);
    expect(snap?.distanceMeters).toBeLessThan(300);
  });

  test('모든 역이 3km 초과면 null (교외 폴백)', () => {
    // 제주 좌표 — 위 3개 역 모두 수백 km.
    expect(nearestStation({ lat: 33.4996, lng: 126.5312 }, STATIONS)).toBeNull();
  });

  test('빈 역 목록이면 null', () => {
    expect(nearestStation({ lat: 37.5, lng: 127.0 }, [])).toBeNull();
  });

  test('동률이면 배열 앞쪽 역이 이긴다 (결정성)', () => {
    const twin: SubwayStation[] = [
      { name: 'A역', lat: 37.5, lng: 127.0 },
      { name: 'B역', lat: 37.5, lng: 127.0 },
    ];
    expect(nearestStation({ lat: 37.5, lng: 127.0 }, twin)?.name).toBe('A역');
  });

  test('임계값 상수는 3000m', () => {
    expect(STATION_SNAP_MAX_METERS).toBe(3000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/map/stationSnap.test.ts`
Expected: FAIL — `Cannot find module './stationSnap'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/map/stationSnap.ts
// S-MAP M5 — 중간지점 → 최근접 지하철역 스냅 (순수 함수, 키 0, 전부 Jest).
//
// "대략적 중간지점" = 산술 중점에서 가장 가까운 역. 3km 초과면 null → 화면은 역 카드를
// 생략하고 기존 산술 중점 + 수동 검색으로 폴백한다(교외 모임). 역 데이터는
// stations.data.ts(공공데이터 정적 번들, 본 타입을 import)가 공급 — DI라 테스트 결정적.

import { haversineMeters } from '@/lib/coords/distance';
import type { Wgs84Coord } from '@/lib/coords/normalize';

/** 지하철역 1건 — stations.data.ts 생성 스크립트와 공유하는 shape. */
export interface SubwayStation {
  name: string;
  lat: number;
  lng: number;
}

export interface StationSnap {
  name: string;
  coord: Wgs84Coord;
  distanceMeters: number;
}

/** 이보다 멀면 역 스냅 생략 (교외 폴백). */
export const STATION_SNAP_MAX_METERS = 3000;

/** coord에서 가장 가까운 역. 전부 3km 초과이거나 목록이 비면 null. 동률은 앞쪽 승. */
export function nearestStation(
  coord: Wgs84Coord,
  stations: readonly SubwayStation[],
): StationSnap | null {
  let best: StationSnap | null = null;
  for (const s of stations) {
    const d = haversineMeters(coord, { lat: s.lat, lng: s.lng });
    if (d <= STATION_SNAP_MAX_METERS && (best === null || d < best.distanceMeters)) {
      best = { name: s.name, coord: { lat: s.lat, lng: s.lng }, distanceMeters: d };
    }
  }
  return best;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/map/stationSnap.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/stationSnap.ts src/lib/map/stationSnap.test.ts
git commit -m "feat(map): M5 최근접 역 스냅 순수 함수 (3km 임계 + 결정적 동률)"
```

---

### Task 2: `autoRecommend` — 자동 쿼리 빌더

**Files:**
- Create: `src/lib/map/autoRecommend.ts`
- Test: `src/lib/map/autoRecommend.test.ts`

**Interfaces:**
- Produces: `RECOMMEND_CATEGORIES = ['맛집', '카페', '술집'] as const` · `type RecommendCategory` · `buildAutoQuery(stationName: string, category: RecommendCategory): string` — Task 8 화면이 칩 렌더와 자동 검색에 사용.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/map/autoRecommend.test.ts
import { buildAutoQuery, RECOMMEND_CATEGORIES } from './autoRecommend';

describe('autoRecommend', () => {
  test('카테고리 칩은 맛집·카페·술집 3종 (맛집이 첫 번째 = 기본)', () => {
    expect(RECOMMEND_CATEGORIES).toEqual(['맛집', '카페', '술집']);
  });

  test('역명 + 카테고리로 검색 쿼리를 만든다', () => {
    expect(buildAutoQuery('공덕역', '맛집')).toBe('공덕역 맛집');
    expect(buildAutoQuery('강남역', '카페')).toBe('강남역 카페');
    expect(buildAutoQuery('홍대입구역', '술집')).toBe('홍대입구역 술집');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/map/autoRecommend.test.ts`
Expected: FAIL — `Cannot find module './autoRecommend'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/map/autoRecommend.ts
// S-MAP M5 — 검색 0타 자동 추천 쿼리. 네이버 지역검색은 좌표 기반 주변검색이 없어
// "역명 + 카테고리" 키워드를 자동 발사한다. 결과 정렬은 sortByDistanceTo(역 좌표)가 담당.

export const RECOMMEND_CATEGORIES = ['맛집', '카페', '술집'] as const;
export type RecommendCategory = (typeof RECOMMEND_CATEGORIES)[number];

/** "공덕역 맛집" 형태의 네이버 지역검색 쿼리. */
export function buildAutoQuery(stationName: string, category: RecommendCategory): string {
  return `${stationName} ${category}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/map/autoRecommend.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/autoRecommend.ts src/lib/map/autoRecommend.test.ts
git commit -m "feat(map): M5 자동 추천 쿼리 빌더 (맛집/카페/술집 칩)"
```

---

### Task 3: 지하철역 정적 데이터 — 생성 스크립트 + `stations.data.ts`

**Files:**
- Create: `scripts/generate-stations.mjs`
- Create: `src/lib/map/stations.data.ts` (스크립트 산출물, 커밋 대상)
- Test: `src/lib/map/stations.data.test.ts`
- 원본 CSV: `scripts/data/stations_raw.csv` (**gitignore 대상 — 커밋하지 않음**, 아래 Step 3에서 다운로드)

**Interfaces:**
- Consumes: `SubwayStation` (Task 1의 `./stationSnap`)
- Produces: `SUBWAY_STATIONS: readonly SubwayStation[]` — Task 8 화면이 `nearestStation(midpoint, SUBWAY_STATIONS)`로 소비.

- [ ] **Step 1: Write the failing sanity test**

```ts
// src/lib/map/stations.data.test.ts
// 생성 데이터 sanity — 좌표 bbox·역명 형식·중복을 CI에서 상시 검증 (스펙 §10 리스크 완화).
import { KOREA_BBOX } from '@/lib/coords/normalize';

import { SUBWAY_STATIONS } from './stations.data';

describe('SUBWAY_STATIONS 데이터 sanity', () => {
  test('실 데이터 규모 (전국 도시철도 500역 이상)', () => {
    expect(SUBWAY_STATIONS.length).toBeGreaterThan(500);
  });

  test('모든 좌표가 한국 bbox 안', () => {
    for (const s of SUBWAY_STATIONS) {
      expect(s.lat).toBeGreaterThanOrEqual(KOREA_BBOX.latMin);
      expect(s.lat).toBeLessThanOrEqual(KOREA_BBOX.latMax);
      expect(s.lng).toBeGreaterThanOrEqual(KOREA_BBOX.lngMin);
      expect(s.lng).toBeLessThanOrEqual(KOREA_BBOX.lngMax);
    }
  });

  test('모든 역명은 비어있지 않고 "역"으로 끝난다', () => {
    for (const s of SUBWAY_STATIONS) {
      expect(s.name.length).toBeGreaterThan(1);
      expect(s.name.endsWith('역')).toBe(true);
    }
  });

  test('이름+좌표 완전 중복 없음 (환승역 dedup 검증)', () => {
    const keys = SUBWAY_STATIONS.map((s) => `${s.name}|${s.lat.toFixed(4)},${s.lng.toFixed(4)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/map/stations.data.test.ts`
Expected: FAIL — `Cannot find module './stations.data'`

- [ ] **Step 3: 원본 CSV 다운로드 (수동 1회)**

1. 브라우저에서 공공데이터포털(data.go.kr) 접속 → **"전국도시철도역사정보표준데이터"** 검색 (표준데이터셋 — 로그인 없이 CSV 다운로드 가능, 공공누리 라이선스)
2. CSV 다운로드 → `scripts/data/stations_raw.csv`로 저장 (디렉토리 생성: `mkdir -p scripts/data`)
3. 인코딩이 EUC-KR이면 UTF-8로 재저장 (VS Code: Reopen with Encoding → Save with Encoding UTF-8). 스크립트가 `역사명` 헤더를 못 찾으면 인코딩 문제이므로 에러 메시지로 안내됨.
4. `.gitignore`에 `scripts/data/` 추가 (원본 CSV 미커밋 — 산출물 `stations.data.ts`만 커밋)

- [ ] **Step 4: 생성 스크립트 작성**

```js
// scripts/generate-stations.mjs
// S-MAP M5 — 전국도시철도역사정보표준데이터 CSV → src/lib/map/stations.data.ts 생성.
//
// 사용법:
//   1) 공공데이터포털에서 "전국도시철도역사정보표준데이터" CSV 다운로드 (UTF-8)
//   2) scripts/data/stations_raw.csv 로 저장
//   3) node scripts/generate-stations.mjs
//
// 처리:
//   - 헤더에서 역사명/역위도/역경도 컬럼 탐색
//   - 역명 정규화: 괄호 병기 제거 + "역" 접미 보정
//   - 한국 bbox(32.5~39.0 / 124.0~132.5, coords/normalize.ts와 정합) 밖 행 제외
//   - 같은 역명은 1km 이내 근접 클러스터로 묶어 좌표 평균 1건 (환승역 dedup).
//     1km 초과 동명역(예: 서울/대전/부산 시청역)은 별개 항목 유지 — 지역별 최근접이 맞도록.

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = 'scripts/data/stations_raw.csv';
const OUT = 'src/lib/map/stations.data.ts';
const BBOX = { latMin: 32.5, latMax: 39.0, lngMin: 124.0, lngMax: 132.5 };
const CLUSTER_METERS = 1000;

// 따옴표 필드를 처리하는 최소 CSV 파서 (주소 필드에 콤마 존재).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== '')) rows.push(row);
  }
  return rows;
}

function haversineMeters(a, b) {
  const R = 6371008.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function normalizeName(raw) {
  const stripped = raw.replace(/\(.*?\)/g, '').trim();
  if (stripped === '') return null;
  return stripped.endsWith('역') ? stripped : `${stripped}역`;
}

const text = readFileSync(SRC, 'utf-8').replace(/^﻿/, '');
const rows = parseCsv(text);
const header = rows[0].map((h) => h.trim());
const nameIdx = header.indexOf('역사명');
const latIdx = header.indexOf('역위도');
const lngIdx = header.indexOf('역경도');
if (nameIdx < 0 || latIdx < 0 || lngIdx < 0) {
  console.error(`헤더에서 역사명/역위도/역경도를 찾지 못했습니다. 실제 헤더: ${header.join(', ')}`);
  console.error('CSV가 EUC-KR이면 UTF-8로 재저장 후 다시 실행하세요.');
  process.exit(1);
}

// 1) 파싱 + 정규화 + bbox 필터
const points = [];
for (const row of rows.slice(1)) {
  const name = normalizeName(row[nameIdx] ?? '');
  const lat = Number(row[latIdx]);
  const lng = Number(row[lngIdx]);
  if (name === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  if (lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) continue;
  points.push({ name, lat, lng });
}

// 2) 역명별 group-by → 1km greedy 클러스터 → 클러스터별 좌표 평균
const byName = new Map();
for (const p of points) {
  if (!byName.has(p.name)) byName.set(p.name, []);
  byName.get(p.name).push(p);
}
const stations = [];
for (const [name, group] of byName) {
  const clusters = [];
  for (const p of group) {
    const hit = clusters.find(
      (c) =>
        haversineMeters({ lat: c.latSum / c.n, lng: c.lngSum / c.n }, p) <= CLUSTER_METERS,
    );
    if (hit) {
      hit.latSum += p.lat;
      hit.lngSum += p.lng;
      hit.n += 1;
    } else {
      clusters.push({ latSum: p.lat, lngSum: p.lng, n: 1 });
    }
  }
  for (const c of clusters) {
    stations.push({
      name,
      lat: Number((c.latSum / c.n).toFixed(6)),
      lng: Number((c.lngSum / c.n).toFixed(6)),
    });
  }
}
stations.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.lat - b.lat));

const body = stations
  .map((s) => `  { name: '${s.name.replace(/'/g, "\\'")}', lat: ${s.lat}, lng: ${s.lng} },`)
  .join('\n');
const file = `// S-MAP M5 — 전국 지하철역 좌표 (생성 파일 — 직접 수정 금지).
// 출처: 공공데이터포털 "전국도시철도역사정보표준데이터" (공공누리 — 상업 이용 가능).
// 재생성: CSV를 scripts/data/stations_raw.csv 에 두고 \`node scripts/generate-stations.mjs\`.
// 환승역은 역명 기준 1km 클러스터 평균 1건, 1km 초과 동명역(타 도시)은 별개 유지.

import type { SubwayStation } from './stationSnap';

export const SUBWAY_STATIONS: readonly SubwayStation[] = [
${body}
];
`;
writeFileSync(OUT, file, 'utf-8');
console.log(`OK: ${stations.length}개 역 → ${OUT}`);
```

- [ ] **Step 5: 스크립트 실행 + 테스트 통과 확인**

Run: `node scripts/generate-stations.mjs`
Expected: `OK: <N>개 역 → src/lib/map/stations.data.ts` (N > 500)

Run: `npm test -- src/lib/map/stations.data.test.ts`
Expected: PASS (4 tests)

Run: `npx tsc --noEmit`
Expected: 에러 0 (생성 파일 타입 정합)

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-stations.mjs src/lib/map/stations.data.ts src/lib/map/stations.data.test.ts .gitignore
git commit -m "feat(map): M5 지하철역 정적 데이터 + 생성 스크립트 (공공데이터, 1km 환승 dedup)"
```

---

### Task 4: 마이그레이션 `0023_group_origins` + D41 결정 기록

**Files:**
- Create: `supabase/migrations/0023_group_origins.sql`
- Modify: `docs/DECISIONS.md` (D40 섹션 뒤, "향후 결정 추가 템플릿" 앞에 D41 삽입)
- Modify: `docs/OPEN_QUESTIONS.md:235-239` (Q-B23 상태 갱신)

**Interfaces:**
- Consumes: `is_group_member`/`is_group_host` (0022), `is_blocked` (D16)
- Produces: `group_origins` 테이블 — Task 5의 클라 모듈이 select/upsert/delete.

- [ ] **Step 1: 마이그레이션 SQL 작성**

```sql
-- ============================================================================
-- 된다 (DenDa) — 0023 group_origins (S-MAP M5, D41)
-- 모임 멤버 각자 출발지 등록 → 중간지점 협업. Q-B23 온디바이스 설계 부분 supersede.
--
-- 보호선:
--   - RLS: 같은 모임 멤버/호스트만 SELECT (D16 is_blocked 통과), 본인 행만 쓰기
--   - self-EXISTS 금지 — 0022 SECURITY DEFINER 헬퍼(is_group_member/is_group_host)만 사용
--   - 모임 삭제·멤버 탈퇴 시 ON DELETE CASCADE로 출발지 자동 소거
--   - 좌표는 클라 normalizeWgs84(D18) 통과 후 저장. DB CHECK는 기본 범위만.
-- ============================================================================

BEGIN;

CREATE TABLE public.group_origins (
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)  -- 1인 1출발지. 수정 = upsert
);

COMMENT ON TABLE public.group_origins IS
  'S-MAP M5 (D41): 중간지점 협업용 멤버 출발지. 모임 멤버에게만 공개, cascade 삭제.';

ALTER TABLE public.group_origins ENABLE ROW LEVEL SECURITY;

-- SELECT: 같은 모임 멤버/호스트 + D16 차단 통과
CREATE POLICY group_origins_select_same_group
  ON public.group_origins FOR SELECT
  USING (
    (
      public.is_group_member(group_origins.group_id, auth.uid())
      OR public.is_group_host(group_origins.group_id, auth.uid())
    )
    AND (
      auth.uid() = user_id
      OR NOT public.is_blocked(auth.uid(), user_id)
    )
  );

-- INSERT: 본인 행만 + 해당 모임 멤버/호스트만
CREATE POLICY group_origins_insert_self
  ON public.group_origins FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.is_group_member(group_origins.group_id, auth.uid())
      OR public.is_group_host(group_origins.group_id, auth.uid())
    )
  );

-- UPDATE/DELETE: 본인 행만
CREATE POLICY group_origins_update_self
  ON public.group_origins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY group_origins_delete_self
  ON public.group_origins FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;

-- ============================================================================
-- 검증 (Supabase SQL editor에서 push 직후 수동 실행):
--
-- -- 1. 정책 4개 존재 확인
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.group_origins'::regclass;
-- -- Expected: select_same_group / insert_self / update_self / delete_self 4 rows
--
-- -- 2. anon 접근 차단 (RLS)
-- -- curl -H "apikey:<anon>" "https://<ref>.supabase.co/rest/v1/group_origins?select=*&limit=1"
-- -- Expected: HTTP 200 + []
--
-- -- 3. cascade: 테스트 모임 삭제 → group_origins 행 자동 소거
-- ============================================================================
```

- [ ] **Step 2: 로컬 DB 적용 확인 (Supabase 로컬 러닝 중이면)**

Run: `supabase db reset` (로컬 미사용 시 skip — 원격 push는 Task 11 운영 노트)
Expected: 에러 없이 0001~0023 적용

- [ ] **Step 3: DECISIONS.md에 D41 추가**

`docs/DECISIONS.md`에서 D40 섹션 끝의 `---` (931행 부근)과 `## 향후 결정 추가 템플릿` 사이에 삽입:

```markdown
## D41 — 모임 출발지 서버 저장 (group_origins, Q-B23 부분 supersede)

| 항목 | 내용 |
|---|---|
| 결정 | 중간지점 협업(S-MAP M5)을 위해 **멤버 출발지(라벨+정확 좌표)를 모임 스코프 `group_origins` 테이블에 서버 저장**한다. 1인 1출발지(PK group_id+user_id, upsert). 보호선 = RLS(같은 모임 멤버/호스트만 SELECT + D16 차단 통과 + 본인 행만 쓰기) + ON DELETE CASCADE(모임 삭제·탈퇴 시 소거) + privacy 고지 개정. recentOrigins(최근 출발지 칩)는 여전히 온디바이스 — Q-B23의 해당 부분은 유지. |
| 근거 | (1) 멤버 각자 입력→자동 취합이 핵심 요구 — 온디바이스로는 멤버 간 공유 불가. (2) 출발지는 검색으로 고른 장소(역·동네)라 원시 GPS보다 민감도 낮고, 모임 스코프 격리+cascade로 최소보유 원칙 충족. (3) 사용자 확정(2026-07-12): "그대로 저장 + RLS". |
| 대안 | (a) ~500m 격자 뭉갬 저장 — 거부: 마커가 실위치와 어긋나 보이는 UX 혼란 대비 이득 작음. (b) Realtime broadcast만(비영속) — 거부: 비동기 모임 앱과 불일치(앞서 입력한 멤버 오프라인 시 취합 불가). |
| 소유자 | Founder (2026-07-12) |
| 결정일 | 2026-07-12 |
| 의존 | [Q-B23](OPEN_QUESTIONS.md#q-b23--멤버-중간지점-추천의-위치-데이터-소스--pipa)(부분 supersede), 0022 RLS 헬퍼, [D16](#d16--차단신고-일관성-helper-function--rls), [D18](#d18--좌표계-정규화) |
| 결과 영향 | (1) `supabase/migrations/0023_group_origins.sql` 신규. (2) `src/lib/map/groupOrigins.ts` 클라 모듈. (3) midpoint 화면 서버 연동 + 진입 버튼 전 멤버 노출. (4) **privacy.tsx 고지 개정 필수** — "기기 내 보관" 문구를 모임 출발지(서버)/최근 칩(온디바이스)으로 이원화. (5) 지하철역 스냅 + 자동 추천(맛집/카페/술집)은 D39 Naver 스택 재사용. |
| 출처 | 브레인스토밍 세션 (2026-07-12) — specs/2026-07-12-midpoint-collab-design.md |

---
```

- [ ] **Step 4: OPEN_QUESTIONS.md Q-B23 갱신**

`docs/OPEN_QUESTIONS.md:235` 제목과 `:239` 상태 줄 수정:

기존:
```markdown
### Q-B23 — 멤버 중간지점 추천의 위치 데이터 소스 + PIPA ✅ Closed (2026-06-08)
```
→
```markdown
### Q-B23 — 멤버 중간지점 추천의 위치 데이터 소스 + PIPA ✅ Closed (2026-06-08) · 부분 supersede by D41 (2026-07-12)
```

기존 `- **상태**:` 줄 뒤에 한 줄 추가:
```markdown
- **후속**: [D41](DECISIONS.md#d41--모임-출발지-서버-저장-group_origins-q-b23-부분-supersede) (2026-07-12) — 모임 출발지는 서버 저장(RLS)으로 전환, 최근 칩만 온디바이스 유지.
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0023_group_origins.sql docs/DECISIONS.md docs/OPEN_QUESTIONS.md
git commit -m "feat(db): M5 group_origins 테이블 + RLS (D41 — Q-B23 부분 supersede)"
```

---

### Task 5: `groupOrigins` — 클라 데이터 모듈

**Files:**
- Create: `src/lib/map/groupOrigins.ts`
- Test: `src/lib/map/groupOrigins.test.ts`

**Interfaces:**
- Consumes: `supabase` (`@/lib/supabase/client`), `normalizeWgs84`/`Wgs84Coord`, `OriginPoint` (`./midpoint`), luxon `DateTime`
- Produces: `interface GroupOrigin { userId: string; nickname: string; label: string; coord: Wgs84Coord }` · `fetchGroupOrigins(groupId: string): Promise<GroupOrigin[]>` · `upsertMyOrigin(groupId: string, userId: string, origin: OriginPoint): Promise<void>` · `deleteMyOrigin(groupId: string, userId: string): Promise<void>` — Task 7 화면이 소비.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/map/groupOrigins.test.ts
import { deleteMyOrigin, fetchGroupOrigins, upsertMyOrigin } from './groupOrigins';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));
const mockFrom = supabase.from as jest.Mock;

describe('fetchGroupOrigins', () => {
  beforeEach(() => mockFrom.mockReset());

  function mockSelectChain(result: { data: unknown; error: unknown }): {
    select: jest.Mock;
    eq: jest.Mock;
    order: jest.Mock;
  } {
    const order = jest.fn().mockResolvedValue(result);
    const eq = jest.fn().mockReturnValue({ order });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });
    return { select, eq, order };
  }

  test('users(nickname) join + group_id 필터 + created_at 오름차순', async () => {
    const { select, eq, order } = mockSelectChain({
      data: [
        { user_id: 'u1', label: '강남역', lat: 37.4979, lng: 127.0276, users: { nickname: '지연' } },
        { user_id: 'u2', label: '홍대입구역', lat: 37.5572, lng: 126.9245, users: null },
      ],
      error: null,
    });

    const out = await fetchGroupOrigins('g-1');

    expect(mockFrom).toHaveBeenCalledWith('group_origins');
    expect(select).toHaveBeenCalledWith('user_id, label, lat, lng, users(nickname)');
    expect(eq).toHaveBeenCalledWith('group_id', 'g-1');
    expect(order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(out).toEqual([
      { userId: 'u1', nickname: '지연', label: '강남역', coord: { lat: 37.4979, lng: 127.0276 } },
      { userId: 'u2', nickname: '멤버', label: '홍대입구역', coord: { lat: 37.5572, lng: 126.9245 } },
    ]);
  });

  test('에러 시 한국어 메시지 throw', async () => {
    mockSelectChain({ data: null, error: { message: 'boom' } });
    await expect(fetchGroupOrigins('g-1')).rejects.toThrow(
      '출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});

describe('upsertMyOrigin', () => {
  beforeEach(() => mockFrom.mockReset());

  test('onConflict group_id,user_id로 본인 행 upsert (updated_at은 UTC ISO)', async () => {
    const upsert = jest.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ upsert });

    await upsertMyOrigin('g-1', 'me', { label: '공덕역', coord: { lat: 37.5432, lng: 126.9512 } });

    expect(mockFrom).toHaveBeenCalledWith('group_origins');
    const [row, opts] = upsert.mock.calls[0] as [Record<string, unknown>, { onConflict: string }];
    expect(row).toMatchObject({
      group_id: 'g-1',
      user_id: 'me',
      label: '공덕역',
      lat: 37.5432,
      lng: 126.9512,
    });
    expect(typeof row.updated_at).toBe('string'); // luxon UTC ISO (D13 — new Date() 금지)
    expect(opts).toEqual({ onConflict: 'group_id,user_id' });
  });

  test('좌표가 WGS84 범위 밖이면 저장 전에 throw (D18)', async () => {
    const upsert = jest.fn();
    mockFrom.mockReturnValue({ upsert });
    await expect(
      upsertMyOrigin('g-1', 'me', { label: 'X', coord: { lat: 999, lng: 0 } }),
    ).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  test('에러 시 한국어 메시지 throw', async () => {
    mockFrom.mockReturnValue({ upsert: jest.fn().mockResolvedValue({ error: { message: 'x' } }) });
    await expect(
      upsertMyOrigin('g-1', 'me', { label: '공덕역', coord: { lat: 37.5, lng: 126.9 } }),
    ).rejects.toThrow('출발지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
  });
});

describe('deleteMyOrigin', () => {
  beforeEach(() => mockFrom.mockReset());

  test('group_id + user_id로 본인 행 삭제', async () => {
    const eqUser = jest.fn().mockResolvedValue({ error: null });
    const eqGroup = jest.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: eqGroup }) });

    await deleteMyOrigin('g-1', 'me');

    expect(eqGroup).toHaveBeenCalledWith('group_id', 'g-1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'me');
  });

  test('에러 시 한국어 메시지 throw', async () => {
    const eqUser = jest.fn().mockResolvedValue({ error: { message: 'x' } });
    const eqGroup = jest.fn().mockReturnValue({ eq: eqUser });
    mockFrom.mockReturnValue({ delete: jest.fn().mockReturnValue({ eq: eqGroup }) });
    await expect(deleteMyOrigin('g-1', 'me')).rejects.toThrow(
      '출발지를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/map/groupOrigins.test.ts`
Expected: FAIL — `Cannot find module './groupOrigins'`

- [ ] **Step 3: Write implementation**

```ts
// src/lib/map/groupOrigins.ts
// S-MAP M5 (D41) — 모임 출발지 서버 CRUD. RLS(0023)가 모임 멤버 조회·본인 쓰기를 강제하므로
// 클라는 자연 안전. nickname은 users FK join — 정책상 못 읽으면 '멤버' 폴백.
//
// D13: updated_at은 luxon UTC ISO (new Date() 금지). D18: 좌표는 normalizeWgs84 통과 후 저장.

import { DateTime } from 'luxon';

import { normalizeWgs84, type Wgs84Coord } from '@/lib/coords/normalize';
import { supabase } from '@/lib/supabase/client';

import type { OriginPoint } from './midpoint';

const FETCH_FAILED = '출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';
const SAVE_FAILED = '출발지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.';
const DELETE_FAILED = '출발지를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.';

export interface GroupOrigin {
  userId: string;
  nickname: string;
  label: string;
  coord: Wgs84Coord;
}

interface OriginRow {
  user_id: string;
  label: string;
  lat: number;
  lng: number;
  users: { nickname: string } | null;
}

/** 모임의 등록된 출발지 전부 (RLS: 같은 모임 멤버만). created_at 오름차순. */
export async function fetchGroupOrigins(groupId: string): Promise<GroupOrigin[]> {
  const { data, error } = await supabase
    .from('group_origins')
    .select('user_id, label, lat, lng, users(nickname)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(FETCH_FAILED);
  }
  const rows = (data ?? []) as unknown as OriginRow[];
  return rows.map((r) => ({
    userId: r.user_id,
    nickname: r.users?.nickname ?? '멤버',
    label: r.label,
    coord: normalizeWgs84(r.lat, r.lng),
  }));
}

/** 내 출발지 등록/수정 (1인 1출발지 upsert). RLS가 본인 행만 허용. */
export async function upsertMyOrigin(
  groupId: string,
  userId: string,
  origin: OriginPoint,
): Promise<void> {
  const coord = normalizeWgs84(origin.coord.lat, origin.coord.lng);
  const { error } = await supabase.from('group_origins').upsert(
    {
      group_id: groupId,
      user_id: userId,
      label: origin.label,
      lat: coord.lat,
      lng: coord.lng,
      updated_at: DateTime.utc().toISO(),
    },
    { onConflict: 'group_id,user_id' },
  );
  if (error) {
    throw new Error(SAVE_FAILED);
  }
}

/** 내 출발지 삭제. */
export async function deleteMyOrigin(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_origins')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) {
    throw new Error(DELETE_FAILED);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/map/groupOrigins.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/groupOrigins.ts src/lib/map/groupOrigins.test.ts
git commit -m "feat(map): M5 모임 출발지 클라 CRUD 모듈 (fetch/upsert/delete + 한국어 에러)"
```

---

### Task 6: `toMidpointScene` 라벨 파라미터 (역 스냅 마커 대체 준비)

**Files:**
- Modify: `src/lib/map/midpoint.ts:63-82` (`toMidpointScene`) + 파일 헤더 주석(1-8행)
- Test: `src/lib/map/midpoint.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Produces: `toMidpointScene(origins: OriginPoint[], midpoint: Wgs84Coord | null, midpointLabel?: string): MapScene` — 기본값 `'중간지점'`으로 기존 호출부 하위호환. Task 8이 역명(`'공덕역'`)을 주입.

- [ ] **Step 1: Write the failing test** — `src/lib/map/midpoint.test.ts`의 `toMidpointScene` describe에 추가:

```ts
test('midpointLabel 주입 시 midpoint 마커 라벨이 역명으로 대체된다 (M5 역 스냅)', () => {
  const scene = toMidpointScene([], { lat: 37.5432, lng: 126.9512 }, '공덕역');
  const mid = scene.markers.find((m) => m.kind === 'midpoint');
  expect(mid?.label).toBe('공덕역');
  expect(mid?.emphasized).toBe(true);
});

test('midpointLabel 생략 시 기본 라벨 "중간지점" (하위호환)', () => {
  const scene = toMidpointScene([], { lat: 37.5432, lng: 126.9512 });
  expect(scene.markers.find((m) => m.kind === 'midpoint')?.label).toBe('중간지점');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/map/midpoint.test.ts`
Expected: FAIL — 첫 테스트에서 label `'중간지점'` ≠ `'공덕역'`

- [ ] **Step 3: Implement** — `toMidpointScene` 시그니처·본문 수정:

```ts
export function toMidpointScene(
  origins: OriginPoint[],
  midpoint: Wgs84Coord | null,
  midpointLabel: string = '중간지점',
): MapScene {
  const markers: MapMarker[] = origins.map((o, i) => ({
    id: `member-${i}-${coordKey(o.coord)}`,
    coord: o.coord,
    kind: 'member',
    label: o.label,
  }));

  if (midpoint !== null) {
    markers.push({
      id: `midpoint-${coordKey(midpoint)}`,
      coord: midpoint,
      kind: 'midpoint',
      label: midpointLabel,
      emphasized: true,
    });
  }

  return { mode: 'midpoint', markers, polylines: [] };
}
```

파일 헤더 주석(1-8행)의 Q-B23 문단도 갱신:

```ts
// S-MAP M3+M5 — 멤버 중간지점 추천 (순수 좌표 로직, 키 0, 전부 Jest 검증).
//
// D41(Q-B23 부분 supersede): 멤버 출발지 = 각자 서버 등록(group_origins, RLS) → 취합해
// 중간점 계산. 최근 출발지 칩(recentOrigins)만 온디바이스 유지. 본 모듈은 좌표 산술만 —
// 색·핀 렌더는 NaverMapScene(DESIGN 토큰)이 점등 시 그린다.
//
// 중간점은 산술 중심(arithmetic centroid). 베타 반경(서울 수 km)에서 구면 중심과의 오차는
// 1m 미만이라 충분 — haversine은 추천 정렬·반경 산출에 재사용한다(distance.ts).
```

- [ ] **Step 4: Run tests**

Run: `npm test -- src/lib/map/midpoint.test.ts`
Expected: PASS (기존 + 신규 2)

- [ ] **Step 5: Commit**

```bash
git add src/lib/map/midpoint.ts src/lib/map/midpoint.test.ts
git commit -m "feat(map): M5 toMidpointScene 라벨 파라미터 (역 스냅 마커 대체 준비)"
```

---

### Task 7: midpoint 화면 — 서버 출발지 연동 (n/m 진행 표시 + 본인만 쓰기)

**Files:**
- Modify: `app/group/[id]/midpoint.tsx` (로컬 origins state → 서버 연동)
- Test: `tests/screens/group/midpoint.test.tsx` (mock·케이스 개편)

**Interfaces:**
- Consumes: Task 5의 `fetchGroupOrigins`/`upsertMyOrigin`/`deleteMyOrigin`/`GroupOrigin` · `fetchGroupForConfirm` (`@/lib/groups/queries`, memberCount) · `useAuth` (`@/lib/auth/setup`) · `useFocusEffect` (expo-router)
- Produces: testID — `origin-progress`(n/m), `origin-row-{i}`(타인 행), `my-origin-remove`(내 삭제), `origins-error-retry`(재시도). Task 8이 이 화면 위에 역 카드·칩을 얹는다.

- [ ] **Step 1: 테스트 개편 (failing)** — `tests/screens/group/midpoint.test.tsx`에서:

(1) expo-router mock에 `useFocusEffect` 추가 (기존 26-29행 교체):

```ts
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => {
  const ReactMod = require('react') as typeof React;
  return {
    useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }),
    useLocalSearchParams: () => ({ id: 'g-1' }),
    useFocusEffect: (cb: () => void | (() => void)) => ReactMod.useEffect(cb, [cb]),
  };
});
```

(2) 신규 mock 3개 추가 (기존 persist/setConfirmedPlace mock 아래):

```ts
let mockUserId: string | undefined = 'me';
jest.mock('@/lib/auth/setup', () => ({
  useAuth: (sel: (s: { session?: { user: { id: string | undefined } } }) => unknown) =>
    sel({ session: { user: { id: mockUserId } } }),
}));

const mockFetchOrigins = jest.fn();
const mockUpsertOrigin = jest.fn();
const mockDeleteOrigin = jest.fn();
jest.mock('@/lib/map/groupOrigins', () => ({
  fetchGroupOrigins: (...a: unknown[]) => mockFetchOrigins(...a),
  upsertMyOrigin: (...a: unknown[]) => mockUpsertOrigin(...a),
  deleteMyOrigin: (...a: unknown[]) => mockDeleteOrigin(...a),
}));

const mockFetchGroup = jest.fn();
jest.mock('@/lib/groups/queries', () => ({
  fetchGroupForConfirm: (...a: unknown[]) => mockFetchGroup(...a),
}));
```

(3) beforeEach에 기본값 추가:

```ts
const MY_ORIGIN = { userId: 'me', nickname: '나', label: '강남역', coord: { lat: 37.4979, lng: 127.0276 } };
const OTHER_ORIGIN = { userId: 'u2', nickname: '지연', label: '홍대입구역', coord: { lat: 37.5572, lng: 126.9245 } };

beforeEach(() => {
  // (기존 초기화 유지) +
  mockUserId = 'me';
  mockFetchOrigins.mockResolvedValue([]);
  mockUpsertOrigin.mockResolvedValue(undefined);
  mockDeleteOrigin.mockResolvedValue(undefined);
  mockFetchGroup.mockResolvedValue({
    id: 'g-1', hostId: 'host', name: '모임', dates: [], memberCount: 5,
    confirmedAt: null, confirmedStartAt: null, confirmedEndAt: null, confirmedPlaceId: null,
  });
});
```

(4) 케이스 교체/추가 — 기존 '출발지 2개 추가 → 중간지점 요약' 류는 서버 fetch 기반으로 재작성:

```ts
test('focus 시 서버 출발지 fetch → 진행 표시 "2/5명 입력" + 타인 행 읽기 전용', async () => {
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId, getByText, queryByTestId } = render(<MidpointScreen />, { wrapper });
  await findByTestId('origin-progress');
  expect(getByText(/2\/5명 입력/)).toBeTruthy();
  expect(getByText(/지연 · 홍대입구역/)).toBeTruthy();
  // 내 행에만 삭제 버튼
  expect(queryByTestId('my-origin-remove')).toBeTruthy();
});

test('OriginInput 선택 → upsertMyOrigin(g-1, me, origin) + refetch', async () => {
  const { getByTestId } = render(<MidpointScreen />, { wrapper });
  await act(async () => {
    fireEvent.press(getByTestId('add-origin-a'));
  });
  expect(mockUpsertOrigin).toHaveBeenCalledWith('g-1', 'me', {
    label: '강남역',
    coord: { lat: 37.4979, lng: 127.0276 },
  });
  expect(mockFetchOrigins.mock.calls.length).toBeGreaterThanOrEqual(2); // mount + upsert 후
});

test('내 출발지 삭제 → deleteMyOrigin(g-1, me)', async () => {
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId } = render(<MidpointScreen />, { wrapper });
  const removeBtn = await findByTestId('my-origin-remove');
  await act(async () => {
    fireEvent.press(removeBtn);
  });
  expect(mockDeleteOrigin).toHaveBeenCalledWith('g-1', 'me');
});

test('서버 출발지 2개 이상 → 중간지점 요약 노출 (미입력자 제외 진행)', async () => {
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId } = render(<MidpointScreen />, { wrapper });
  expect(await findByTestId('midpoint-summary')).toBeTruthy();
});

test('fetch 실패 → 한국어 에러 + 재시도 버튼이 재호출', async () => {
  mockFetchOrigins.mockRejectedValueOnce(new Error('출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.'));
  const { findByTestId, getByText } = render(<MidpointScreen />, { wrapper });
  const retry = await findByTestId('origins-error-retry');
  expect(getByText(/출발지를 불러오지 못했어요/)).toBeTruthy();
  await act(async () => {
    fireEvent.press(retry);
  });
  expect(mockFetchOrigins.mock.calls.length).toBeGreaterThanOrEqual(2);
});
```

(5) 기존 확정 플로우 테스트('추천 결과는 중간지점에 가까운 순', '추천 tap → 확정', '마커 onPress 확정')는 출발지 세팅 부분만 교체: `fireEvent.press(getByTestId('add-origin-a'))` × 2 대신 `mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN])` 후 `await findByTestId('midpoint-summary')`로 대기. 단언(persist/setConfirmedPlace/replace)은 그대로 유지. '출발지 추가 → saveRecentOrigin 호출' 테스트도 유지(동작 불변).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/screens/group/midpoint.test.tsx`
Expected: FAIL — `origin-progress` 등 testID 부재

- [ ] **Step 3: 화면 구현** — `app/group/[id]/midpoint.tsx` 수정 핵심 (헤더 주석도 D41로 갱신):

```tsx
// (신규 import)
import { useFocusEffect } from 'expo-router'; // 기존 expo-router import에 추가
import { useAuth } from '@/lib/auth/setup';
import {
  deleteMyOrigin,
  fetchGroupOrigins,
  upsertMyOrigin,
  type GroupOrigin,
} from '@/lib/map/groupOrigins';
import { fetchGroupForConfirm } from '@/lib/groups/queries';

// (컴포넌트 내부 — 기존 const [origins, setOrigins] = useState<OriginPoint[]>([]) 교체)
const userId = useAuth((s) => s.session?.user.id);
const [origins, setOrigins] = useState<GroupOrigin[]>([]);
const [memberCount, setMemberCount] = useState(0);
const [loadError, setLoadError] = useState<string | null>(null);

const load = useCallback(async (): Promise<void> => {
  try {
    const [fetched, group] = await Promise.all([
      fetchGroupOrigins(groupId),
      fetchGroupForConfirm(groupId),
    ]);
    setOrigins(fetched);
    setMemberCount(group.memberCount);
    setLoadError(null);
  } catch (e: unknown) {
    setLoadError(
      e instanceof Error ? e.message : '출발지를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    );
  }
}, [groupId]);

useFocusEffect(
  useCallback(() => {
    void load();
  }, [load]),
);

const handleAddOrigin = useCallback(
  (origin: OriginPoint): void => {
    if (userId === undefined) return;
    upsertMyOrigin(groupId, userId, origin)
      .then(() => load())
      .catch((e: unknown) => {
        toast.show({
          message:
            e instanceof Error ? e.message : '출발지를 저장하지 못했어요. 잠시 후 다시 시도해주세요.',
          variant: 'error',
        });
      });
    saveRecentOrigin(recentOriginsStorage, origin)
      .then((merged) => setRecents(merged))
      .catch(() => {
        // 온디바이스 칩 best-effort (Q-B23 유지 부분)
      });
  },
  [groupId, userId, load, toast],
);

const handleRemoveMine = useCallback((): void => {
  if (userId === undefined) return;
  deleteMyOrigin(groupId, userId)
    .then(() => load())
    .catch((e: unknown) => {
      toast.show({
        message:
          e instanceof Error ? e.message : '출발지를 삭제하지 못했어요. 잠시 후 다시 시도해주세요.',
        variant: 'error',
      });
    });
}, [groupId, userId, load, toast]);

// 중간점·scene은 서버 origins 기반 (OriginPoint shape로 매핑)
const originPoints = useMemo<OriginPoint[]>(
  () => origins.map((o) => ({ label: o.label, coord: o.coord })),
  [origins],
);
const midpoint = useMemo(
  () => (originPoints.length >= 2 ? computeMidpoint(originPoints.map((o) => o.coord)) : null),
  [originPoints],
);
```

JSX — 기존 origins 칩 블록(191-218행)을 교체:

```tsx
{/* D41: 진행 표시 + 출발지 목록 (본인 행만 삭제 가능, 타인 읽기 전용) */}
{memberCount > 0 ? (
  <Caption color={colors.text.secondary} style={{ marginTop: space[2] }} testID="origin-progress">
    {origins.length}/{memberCount}명 입력
  </Caption>
) : null}

{loadError !== null ? (
  <Pressable
    onPress={() => void load()}
    accessibilityRole="button"
    accessibilityLabel="출발지 다시 불러오기"
    testID="origins-error-retry"
    style={({ pressed }) => ({
      backgroundColor: rowPressBg(pressed, colors, colors.surface[1]),
      borderRadius: radius.md,
      padding: space[3],
      marginTop: space[2],
    })}
  >
    <Caption color={colors.semantic.error.fg}>{loadError} (탭해서 다시 시도)</Caption>
  </Pressable>
) : null}

{origins.map((origin, index) =>
  origin.userId === userId ? (
    <Pressable
      key={origin.userId}
      onPress={handleRemoveMine}
      accessibilityRole="button"
      accessibilityLabel={`내 출발지 ${origin.label} 빼기`}
      testID="my-origin-remove"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.brand[50],
        borderRadius: radius.pill,
        paddingHorizontal: space[3],
        paddingVertical: space[2],
        marginTop: space[2],
        alignSelf: 'flex-start',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Caption color={colors.brand[600]}>나 · {origin.label}</Caption>
      <Icon name="닫기" color={colors.brand[600]} size={14} />
    </Pressable>
  ) : (
    <View
      key={origin.userId}
      testID={`origin-row-${index}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: space[2],
        marginTop: space[1],
      }}
    >
      <Icon name="장소" color={colors.text.tertiary} size={14} />
      <Caption color={colors.text.secondary} style={{ marginLeft: space[1] }}>
        {origin.nickname} · {origin.label}
      </Caption>
    </View>
  ),
)}
```

`handleRemoveOrigin(index)` 함수와 scene의 `toMidpointScene(origins, ...)` 호출부는 `originPoints` 사용으로 교체. 안내 카피(256행)는 "출발지를 등록해주세요 · 2명 이상 모이면 중간지점을 찾아드려요"로 갱신.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/screens/group/midpoint.test.tsx`
Expected: PASS (개편 케이스 전부)

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/group/[id]/midpoint.tsx tests/screens/group/midpoint.test.tsx
git commit -m "feat(map): M5 중간지점 화면 서버 출발지 연동 (n/m 진행·본인만 쓰기·focus refetch)"
```

---

### Task 8: midpoint 화면 — 역 카드 + 카테고리 칩 자동 추천

**Files:**
- Modify: `app/group/[id]/midpoint.tsx` (Task 7 결과 위에)
- Test: `tests/screens/group/midpoint.test.tsx` (케이스 추가)

**Interfaces:**
- Consumes: `nearestStation`/`StationSnap`/`SUBWAY_STATIONS` (Task 1·3) · `buildAutoQuery`/`RECOMMEND_CATEGORIES`/`RecommendCategory` (Task 2) · `toMidpointScene` 라벨 파라미터 (Task 6)
- Produces: testID — `station-card`, `reco-chip-맛집`/`reco-chip-카페`/`reco-chip-술집`

- [ ] **Step 1: 테스트 추가 (failing)** — mock 2개 추가:

```ts
import type { StationSnap } from '@/lib/map/stationSnap';

let mockSnap: StationSnap | null = null;
jest.mock('@/lib/map/stationSnap', () => ({
  ...jest.requireActual('@/lib/map/stationSnap'),
  nearestStation: () => mockSnap,
}));
jest.mock('@/lib/map/stations.data', () => ({ SUBWAY_STATIONS: [] }));
```

beforeEach에 `mockSnap = null;` 추가. 케이스:

```ts
const SNAP: StationSnap = {
  name: '공덕역',
  coord: { lat: 37.5432, lng: 126.9512 },
  distanceMeters: 420,
};

test('역 스냅 성공 → 역 카드 + "○○역 맛집" 자동 검색 발사', async () => {
  mockSnap = SNAP;
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId, getByText } = render(<MidpointScreen />, { wrapper });
  expect(await findByTestId('station-card')).toBeTruthy();
  expect(getByText(/공덕역 근처가 중간이에요/)).toBeTruthy();
  expect(getByText(/420m/)).toBeTruthy();
  await waitFor(() => expect(mockSetQuery).toHaveBeenCalledWith('공덕역 맛집'));
});

test('카테고리 칩 전환 → 쿼리 재발사', async () => {
  mockSnap = SNAP;
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId } = render(<MidpointScreen />, { wrapper });
  const chip = await findByTestId('reco-chip-카페');
  await act(async () => {
    fireEvent.press(chip);
  });
  expect(mockSetQuery).toHaveBeenCalledWith('공덕역 카페');
});

test('수동 검색 입력 → 자동 모드 해제 (칩 selected 해제 + 입력값 그대로 검색)', async () => {
  mockSnap = SNAP;
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId, getByTestId } = render(<MidpointScreen />, { wrapper });
  await findByTestId('station-card');
  await act(async () => {
    fireEvent.changeText(getByTestId('reco-search-input'), '파스타');
  });
  expect(mockSetQuery).toHaveBeenCalledWith('파스타');
  expect(getByTestId('reco-chip-맛집').props.accessibilityState?.selected).toBe(false);
});

test('역 3km 초과(스냅 null) → 역 카드·칩 없음, 기존 수동 검색 유지 (교외 폴백)', async () => {
  mockSnap = null;
  mockFetchOrigins.mockResolvedValue([MY_ORIGIN, OTHER_ORIGIN]);
  const { findByTestId, queryByTestId } = render(<MidpointScreen />, { wrapper });
  await findByTestId('midpoint-summary');
  expect(queryByTestId('station-card')).toBeNull();
  expect(queryByTestId('reco-chip-맛집')).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/screens/group/midpoint.test.tsx`
Expected: FAIL — `station-card` 부재

- [ ] **Step 3: 화면 구현**

```tsx
// (신규 import)
import { buildAutoQuery, RECOMMEND_CATEGORIES, type RecommendCategory } from '@/lib/map/autoRecommend';
import { nearestStation } from '@/lib/map/stationSnap';
import { SUBWAY_STATIONS } from '@/lib/map/stations.data';

// (컴포넌트 내부)
const snap = useMemo(
  () => (midpoint !== null ? nearestStation(midpoint, SUBWAY_STATIONS) : null),
  [midpoint],
);
// category !== null = 자동 추천 모드. 수동 입력 시 null.
const [category, setCategory] = useState<RecommendCategory | null>(RECOMMEND_CATEGORIES[0]);

useEffect(() => {
  if (snap !== null && category !== null) {
    setQuery(buildAutoQuery(snap.name, category));
  }
}, [snap, category, setQuery]);

// 추천 정렬·마커·씬의 중심 = 역(스냅 시) 또는 산술 중점
const recoCenter = snap !== null ? snap.coord : midpoint;
const recommended = useMemo(
  () => (recoCenter !== null ? sortByDistanceTo(results, recoCenter) : results),
  [results, recoCenter],
);

const scene = useMemo(() => {
  const base = toMidpointScene(
    originPoints,
    recoCenter,
    snap !== null ? snap.name : '중간지점',
  );
  const placeMarkers: MapMarker[] = recommended.map((r) => ({
    id: r.providerPlaceId,
    coord: { lat: r.lat, lng: r.lng },
    kind: 'place',
    label: r.name,
    actionId: r.providerPlaceId,
  }));
  return { ...base, markers: [...base.markers, ...placeMarkers] };
}, [originPoints, recoCenter, snap, recommended]);

function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}
```

JSX — `midpoint-summary` 블록(220-253행) 안, 기존 Caption 위에 역 카드+칩 삽입 (스냅 시에만):

```tsx
{snap !== null ? (
  <View
    testID="station-card"
    style={{
      backgroundColor: colors.surface[1],
      borderRadius: radius.md,
      padding: space[4],
      marginTop: space[2],
      borderWidth: 1,
      borderColor: colors.border.subtle,
    }}
  >
    <Body variant="bold" color={colors.text.primary}>
      {snap.name} 근처가 중간이에요
    </Body>
    <Caption color={colors.text.secondary} style={{ marginTop: space[1] }} tabularNums>
      중간지점에서 {formatDistance(snap.distanceMeters)}
    </Caption>
    <View style={{ flexDirection: 'row', marginTop: space[2] }}>
      {RECOMMEND_CATEGORIES.map((c) => {
        const selected = category === c;
        return (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${c} 추천 보기`}
            testID={`reco-chip-${c}`}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => ({
              backgroundColor: selected
                ? colors.brand[50]
                : rowPressBg(pressed, colors, colors.surface[2]),
              borderRadius: radius.pill,
              paddingHorizontal: space[3],
              paddingVertical: space[2],
              marginRight: space[2],
            })}
          >
            <Caption color={selected ? colors.brand[600] : colors.text.secondary}>{c}</Caption>
          </Pressable>
        );
      })}
    </View>
  </View>
) : null}
```

검색 TextInput의 onChangeText를 수동 모드 전환으로 교체:

```tsx
<TextInput
  value={query}
  onChangeText={(t) => {
    setCategory(null); // 수동 모드 — 자동 재발사 중단
    setQuery(t);
  }}
  // (나머지 props 기존 유지)
/>
```

역 카드 카피와 겹치는 기존 "중간지점을 찾았어요..." Caption은 스냅 시 "다른 곳이 좋다면 직접 검색해보세요"로, 폴백 시 기존 문구 유지:

```tsx
<Caption color={colors.text.secondary}>
  {snap !== null
    ? '다른 곳이 좋다면 직접 검색해보세요'
    : '중간지점을 찾았어요 · 근처에서 만날 장소를 검색해보세요'}
</Caption>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/screens/group/midpoint.test.tsx`
Expected: PASS (전 케이스)

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/group/[id]/midpoint.tsx tests/screens/group/midpoint.test.tsx
git commit -m "feat(map): M5 역 스냅 카드 + 카테고리 칩 자동 추천 (검색 0타, 3km 교외 폴백)"
```

---

### Task 9: 그룹 화면 — 중간지점 진입 버튼 전 멤버 노출

**Files:**
- Modify: `app/group/[id]/index.tsx:422-466` (isHost 분기 재구성)
- Test: `tests/screens/group/confirm.test.tsx` (케이스 1개 추가)

**Interfaces:**
- Consumes: 기존 `isConfirmed`/`isHost` 로컬 변수, testID `place-pick-button`/`midpoint-entry-button` 유지

- [ ] **Step 1: 테스트 추가 (failing)** — confirm.test.tsx의 기존 'S-MAP M3' 테스트(274행) 아래:

```ts
test('M5: 비호스트 멤버 + 확정 + 장소 미정 → 중간지점 버튼 노출 (출발지 등록 진입)', async () => {
  mockUserId = NON_HOST_ID;
  mockFetchGroup.mockResolvedValue({
    id: VALID_GROUP_ID,
    hostId: HOST_ID,
    name: '확정된 모임',
    dates: ['2026-06-01'],
    memberCount: 2,
    confirmedAt: '2026-05-30T10:00:00.000Z',
    confirmedStartAt: '2026-06-01T10:00:00.000Z',
    confirmedEndAt: '2026-06-01T12:00:00.000Z',
    confirmedPlaceId: null,
  });
  const { findByTestId, queryByTestId } = render(<GroupConfirmScreen />, { wrapper });
  expect(await findByTestId('midpoint-entry-button')).toBeTruthy();
  expect(queryByTestId('place-pick-button')).toBeNull(); // 장소 확정 CTA는 여전히 호스트만
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/screens/group/confirm.test.tsx`
Expected: FAIL — 비호스트에서 `midpoint-entry-button` 부재

- [ ] **Step 3: Implement** — `app/group/[id]/index.tsx:422` 분기를 재구성 (버튼 JSX 자체는 기존 그대로, 감싸는 조건만 변경):

```tsx
) : isConfirmed ? (
  <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
    {isHost ? (
      <Pressable
        onPress={() => router.push(`/group/${groupId}/place-search`)}
        /* (기존 place-pick-button Pressable 424-439행 그대로) */
      >
        {/* ... */}
      </Pressable>
    ) : null}
    {/* S-MAP M3+M5(D41): 중간지점 진입은 전 멤버 — 각자 출발지 등록. 장소 확정은 호스트만(RLS). */}
    <Pressable
      onPress={() =>
        router.push({ pathname: '/group/[id]/midpoint', params: { id: groupId } })
      }
      accessibilityRole="button"
      accessibilityLabel="중간지점으로 찾기"
      testID="midpoint-entry-button"
      style={({ pressed }) => ({
        marginTop: isHost ? space[2] : 0,
        borderRadius: radius.md,
        padding: space[4],
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: rowPressBg(pressed, colors, colors.surface[1]),
        borderWidth: 1,
        borderColor: colors.border.subtle,
      })}
    >
      <Icon name="장소" color={colors.text.secondary} size={18} />
      <Body color={colors.text.primary} style={{ marginLeft: space[2] }}>
        중간지점으로 찾기
      </Body>
    </Pressable>
  </View>
) : null}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/screens/group/confirm.test.tsx`
Expected: PASS (기존 케이스 포함 — '비호스트 → place-pick-button 미노출'도 그대로 그린)

- [ ] **Step 5: Commit**

```bash
git add app/group/[id]/index.tsx tests/screens/group/confirm.test.tsx
git commit -m "feat(group): M5 중간지점 진입 버튼 전 멤버 노출 (출발지 등록, 확정은 호스트만)"
```

---

### Task 10: privacy 고지 개정 (법적 P0)

**Files:**
- Modify: `app/(auth)/privacy.tsx:81-86` ("마. 기기 내 보관" 섹션)
- Test: `tests/screens/(auth)/privacy.test.tsx` (기존 단언 확인·갱신)

- [ ] **Step 1: 기존 테스트 확인** — `tests/screens/(auth)/privacy.test.tsx`에서 `출발지` 또는 `기기에만` 문자열 단언을 Grep. 존재하면 Step 2의 새 카피 기준으로 함께 수정, 없으면 신규 단언 추가:

```ts
test('D41: 모임 출발지 서버 저장 + 최근 칩 온디바이스 고지', () => {
  const { getByText } = render(<PrivacyScreen />, { wrapper }); // 기존 파일의 render 관례 사용
  expect(getByText(/해당 모임 멤버에게만 공개/)).toBeTruthy();
  expect(getByText(/최근 출발지 칩은 기기에만 저장/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "tests/screens/(auth)/privacy.test.tsx"`
Expected: FAIL — 새 카피 부재

- [ ] **Step 3: Implement** — `app/(auth)/privacy.tsx:81-86` 교체:

```tsx
<SubHeading text="마. 중간지점 출발지" colors={colors} space={space} />
<Bullet
  text="중간지점 찾기에 등록한 출발지(장소명·좌표)는 해당 모임 멤버에게만 공개되며, 모임 삭제 또는 탈퇴 시 함께 삭제됩니다"
  colors={colors}
  space={space}
/>
<Bullet
  text="최근 출발지 칩은 기기에만 저장되며 서버로 전송되지 않습니다"
  colors={colors}
  space={space}
/>
```

- [ ] **Step 4: Run tests**

Run: `npm test -- "tests/screens/(auth)/privacy.test.tsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "app/(auth)/privacy.tsx" "tests/screens/(auth)/privacy.test.tsx"
git commit -m "docs(legal): M5 출발지 고지 개정 — 모임 출발지 서버 저장(D41) + 최근 칩 온디바이스"
```

---

### Task 11: 종료 게이트 — 전체 그린 + 운영 노트

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npm test`
Expected: 전량 PASS (기존 1211 + 신규 ~25, skip 1 유지)

- [ ] **Step 2: 정적 검사**

Run: `npx tsc --noEmit && npm run lint`
Expected: 0 errors / 0 warnings

- [ ] **Step 3: 운영 노트 확인 (코드 아님 — 사용자·운영 결정 대기)**

- `supabase db push` — 0023 마이그레이션 원격 반영 (반영 전까지 실환경에서 출발지 저장 불가). **실행 전 사용자 확인.**
- 이후 Supabase SQL editor에서 0023 말미 검증 쿼리 수동 실행.

- [ ] **Step 4: /ship-task 흐름** — SESSION_LOG·PROGRESS·NOW.md 갱신 + 최종 커밋은 프로젝트 `/ship-task` 스킬 절차를 따른다 (전체 그린 확인 후에만).

## Self-Review 결과

- **Spec coverage**: §1→Task 4·5, §2→Task 1·3(+마커 대체 Task 6·8), §3→Task 2·8, §4(모듈)→Task 5, §5(화면·진입·고지)→Task 7·8·9·10, §6(D41)→Task 4, §7(테스트)→각 태스크 Step 1, §8(수용 기준)→Task 7~11. 갭 없음.
- **Placeholder scan**: 없음 (Task 3 CSV 다운로드는 수동 1회 절차로 명시, Task 10 Step 1은 조건 분기 모두 코드 제시).
- **Type consistency**: `SubwayStation`(Task 1 정의 → Task 3 import) · `StationSnap`(Task 1 → Task 8 mock) · `GroupOrigin`(Task 5 → Task 7) · `toMidpointScene` 3-인자(Task 6 → Task 8) · `RecommendCategory`(Task 2 → Task 8) 일치 확인.
