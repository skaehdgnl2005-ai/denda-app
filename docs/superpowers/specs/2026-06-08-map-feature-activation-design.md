# 지도 기능 활성화 + 4대 확장 — 통합 로드맵 (Design Spec)

> 작성: 2026-06-08 · 상태: **Draft (리뷰 대기)** · 작업 코드(가칭): **S-MAP**
> 선행 결정: [D18 좌표 정규화], [D25 cold start/lazy], [D26 검색 quota], [D36 Naver fallback], [D37 Kakao 평가 트랙]
> 신설 예정: **D38**(MapHost seam) · **Q-B23**(멤버 위치=출발지 입력+최근추천, 답 확정)

---

## 0. 한 줄 요약

지도는 현재 **"부분 활성화"** — 두 화면(`(tabs)/map`, `schedule/map`)에 진입은 되지만 네이티브 지도는 안 그려지고 "준비 중" placeholder만 보인다. 데이터·로직 레이어는 완성·테스트 통과. 본 로드맵은 **`MapHost` 단일 경계**를 깔아 (1) 키 없이 검증 가능한 "주변" 슬라이스를 지금 구현하고 (2) 네이버 키 + EAS 빌드가 오면 **코드 변경 없이 점등**되도록 staging 한다. 그 위에 4개 확장(① 동선·일정 지도 / ② 제휴 마커 / ③ 검색→장소 확정 / ④ 중간지점 추천)을 정의·순서화한다.

---

## 1. 현재 상태 (감사 결과 요약)

9-에이전트 코드 감사 결론: **partial**.

| 항목 | 상태 |
|---|---|
| 라우팅·내비게이션 | ✅ 탭 "지도" → [`app/(tabs)/map.tsx`], 홈 "지도로 보기" → [`app/schedule/map.tsx`] |
| 데이터·로직 레이어 | ✅ `scheduleMapPoint`·`polyline`·`coords/normalize`(D18)·`useMapSearch`(D26)·Provider 추상화 — Jest 그린(schedule/map 6 · tabs/map 7) |
| 네이티브 지도 렌더 | ❌ `@mj-studio/react-native-naver-map` 미설치·미import. 두 화면 모두 텍스트 placeholder |
| 라이브 장소 검색 | ❌ `NAVER_CLIENT_ID/SECRET` Edge 미설정 → 런타임 503 |
| 의도 | 이건 버그가 아니라 **의도된 deferral**(네이버 Client ID 미발급 + 네이티브 빌드 필요 → EAS 운영 트랙) |

런타임 사실: `expo-dev-client` 설치됨([package.json]) → **dev client**(Expo Go 아님). Kakao 네이티브 플러그인이 **"키 있을 때만 포함"** 조건부 패턴으로 이미 구현됨([app.config.ts] L11-20) → 네이버 지도도 동일 선례 적용 가능.

---

## 2. 목표 / 비목표

**목표**
- G1. 키 없이도 Jest로 검증되는 지도 관련 코드("주변")를 실제로 활성화/개선.
- G2. 네이버 키 + EAS 빌드 도착 시 **코드 변경 0**(env + rebuild)으로 네이티브 지도가 점등되는 seam 구축.
- G3. 4개 확장이 **동일 렌더 경로**를 공유하도록 `MapScene` 계약 확정.

**비목표 (이번 범위 밖)**
- N1. 실제 네이티브 지도 렌더 검증 — 네이버 Client ID + EAS 빌드 필요(사용자/운영 트랙).
- N2. 라이브 장소 검색 활성화 — Edge secret 등록 필요(사용자).
- N3. 🔒 **제휴(partnership) 데이터 연동 — Phase 3 (D3).** Phase 1+2 코드 작성 금지([PROJECT_CONTEXT §6]). ②는 "마커 *시각 capability*"까지만.
- N4. 60fps 부하 측정 — production binary 의무(dev 측정 금지, testing rule).

---

## 3. Claude 가능 / 사용자·운영 게이트 (경계 명시)

| 버킷 | 항목 | 주체 |
|---|---|---|
| 코드 | `MapHost`/`MapScene`/`isMapAvailable`/selector + 테스트 | ✅ Claude |
| 코드 | 패키지 설치 + `NaverMapScene`(게이트 뒤) + app.config 조건부 플러그인 | ✅ Claude |
| 코드 | 화면 placeholder → `<MapHost>` 교체 | ✅ Claude |
| 키 | 네이버 Maps Client ID, Naver Local ID/Secret, (선택)Kakao REST | ❌ 사용자 |
| 빌드 | `expo prebuild` + EAS/`expo run:android` 네이티브 빌드 + 실기기 60fps | ❌ 사용자/운영 |
| 에셋 | 제휴 마커 PNG 1.5x/2x/3x (Q-B13) | ❌ 디자인 |
| 데이터 | 멤버 위치 소스 + PIPA 동의(④) | ❌ 결정 필요(Q-B23) |

---

## 4. 기반 아키텍처 (A안 + S1 staging) — 확정

### 4.1 `MapScene` 계약 (순수 데이터, 키 0, 전부 Jest 검증)

```ts
// src/lib/map/mapScene.ts (신규)
import type { Wgs84Coord } from '@/lib/coords/normalize';
import type { PolylineSegment } from '@/lib/schedules/polyline';
import type { MapViewMode } from '@/lib/places/MapViewMode';

export type MapMarkerKind = 'order' | 'place' | 'partner' | 'midpoint' | 'member';

export interface MapMarker {
  id: string;
  coord: Wgs84Coord;          // D18 normalize 통과 좌표만
  kind: MapMarkerKind;
  label?: string;             // ①②③ 숫자 또는 장소명
  order?: number;             // kind==='order'
  emphasized?: boolean;       // 제휴/확정 강조 (② 시각 capability)
  actionId?: string;          // onPress 시 화면이 해석할 키 (확정/상세 라우팅)
}

export interface MapScenePolyline {
  segments: PolylineSegment[];
  style: 'dashed-brand';      // DESIGN §10.5 (brand-500 2pt dashed)
}

export interface MapScene {
  mode: MapViewMode;          // 'search' | 'schedule' (확장 가능)
  markers: MapMarker[];
  polylines: MapScenePolyline[];
  region?: { center: Wgs84Coord }; // 없으면 마커 fit-to-bounds
}
```

**불변식**: 모든 `coord`는 `normalizeWgs84` 통과값(D18). 색·stroke·dash는 **데이터에 없음** — 렌더러(`NaverMapScene`)가 DESIGN 토큰으로만 그린다(시각 결정 토큰 외 금지, D4/D5).

### 4.2 `MapHost` 경계 (네이티브 분기는 여기 한 곳)

```tsx
// src/components/map/MapHost.tsx (신규)
export function MapHost({ scene, fallback }: { scene: MapScene; fallback?: ReactNode }) {
  if (!isMapAvailable()) return fallback ?? <MapPlaceholder mode={scene.mode} />;
  const NaverMapScene = lazy(() => import('./NaverMapScene')); // D25 lazy, 키 있을 때만 실행
  return (
    <Suspense fallback={<MapLoading />}>
      <NaverMapScene scene={scene} />
    </Suspense>
  );
}
```

```ts
// src/lib/map/mapAvailability.ts (신규)
export function isMapAvailable(): boolean {
  const id = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? '';
  const enabled = process.env.EXPO_PUBLIC_MAP_ENABLED === 'true';
  return enabled && id.length > 0 && id !== 'your-naver-client-id';
}
```

- dev(키 placeholder)에서는 `false` → 동적 import **미실행** → 네이티브 미설치여도 안전, placeholder 그대로.
- `MapPlaceholder`는 현재 "준비 중" 카피를 컴포넌트로 추출하되 **"리스트로 보기" 유도형**으로 개선: "지도는 준비 중 — 지금은 리스트로 볼 수 있어요" + 리스트 모드 전환 버튼. 점등 전 대기창을 dead-end 대신 작동하는 리스트로 보냄(저비용·고효율). 색·카피는 DESIGN 토큰 / ko-kr.

### 4.3 `NaverMapScene` (S1: 지금 작성, 게이트 뒤)

```tsx
// src/components/map/NaverMapScene.tsx (신규 — isMapAvailable()===true 일 때만 로드)
// @mj-studio/react-native-naver-map import. MapScene → NaverMapView + Marker + Path 매핑.
// 색·dash·32pt 배지·강조 스타일은 DESIGN §10.1/§10.2/§10.5 토큰만.
```

### 4.4 app.config 조건부 플러그인 (Kakao 패턴 복제)

```ts
// app.config.ts — KAKAO 패턴과 동일하게:
const NAVER_MAP_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? '';
const naverMapPlugin = (NAVER_MAP_CLIENT_ID && NAVER_MAP_CLIENT_ID !== 'your-naver-client-id')
  ? ['@mj-studio/react-native-naver-map', { client: { ios: '...', android: NAVER_MAP_CLIENT_ID } }]
  : null;
// plugins: [..., ...(naverMapPlugin ? [naverMapPlugin] : [])]
```

> ⚠️ 위 플러그인 config 키 모양(`client.ios/android`)은 **예시** — `@mj-studio/react-native-naver-map`의 실제 config plugin API로 **M0에서 확정**한다.

→ 키 없으면 플러그인 미포함(현 빌드 무영향). 키 도착 시 자동 포함.

### 4.5 활성화 = 코드 변경 0

사용자가 ① 네이버 Maps Client ID 발급 → `.env`에 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` + `EXPO_PUBLIC_MAP_ENABLED=true` 설정 ② `expo prebuild && expo run:android`(또는 EAS) → `isMapAvailable()` true → 점등. **소스 변경 없음.**

---

## 5. 4대 확장 — 분해 (각: 지금 검증가능 "주변" + 점등 "렌더")

### ① 동선·일정 지도 (S15 연장) — 데이터 100% 준비

- **주변(now)**: `toScheduleScene(points)` selector — `ScheduleMapPoint[]` + `buildPolylineSegments` → `MapScene`(kind `order` 마커 + dashed-brand 폴리라인). `schedule/map.tsx`의 placeholder 블록을 `<MapHost scene={toScheduleScene(visiblePoints)} />`로 교체. 순수 selector + 화면 wire 모두 Jest 검증.
- **렌더(점등)**: 32pt brand-500 ①②③ 마커 + 보라 2pt dashed 폴리라인(DESIGN §10.5).
- **의존**: 없음(데이터·polyline 완성).

### ② 제휴 마커 — 🔒 Phase 3 경계 주의

- **주변(now, 허용 범위)**: `MapScene`/`NaverMapScene`의 **`emphasized` 마커 시각 capability**만 구현(강조 스타일 분기 + 리스트/카드 "제휴" 배지 컴포넌트). 데이터 소스는 **빈/스텁**.
- **금지**: 실제 partnership 데이터 연동·스키마 — **Phase 3(D3)** 코드 작성 금지([PROJECT_CONTEXT §6]).
- **렌더(점등)**: 제휴 강조 마커. **PNG 에셋 = Q-B13 대기**. 에셋 전엔 brand-500 fallback 스타일.
- **의존**: Q-B13(에셋) + Phase 3 게이트(데이터). → 이번엔 **시각 capability까지만**.

### ③ 검색→장소 확정 UX — Gate #2 크리티컬 패스

- **주변(now)**: [`place-search.tsx`]→[`place.tsx`] 확정 플로우를 리스트에서 완성/개선(검색결과 탭 → 모임 장소 확정, 더블탭 idempotent — testing "예약하기 click 정확도" critical path). `MapScene` 마커의 `actionId`로 동일 확정 액션을 정의해 둠. 모두 Jest 검증.
- **렌더(점등)**: 마커 onPress → 동일 확정 액션(`(tabs)/map.tsx` 주석의 `router.push('/group/[id]/place')` wire).
- **의존**: 라이브 검색은 Edge secret 필요하나, **확정 플로우 자체는 mock 데이터로 검증 가능**.

### ④ 멤버 중간지점 추천 — 출발지 입력 + 최근 출발지 추천

- **결정(Q-B23 답)**: 멤버 위치 = **각자 출발지 직접 입력**. 입력창에 **자주/최근 쓴 출발지 2개를 칩으로 추천**(빠른 선택). 출발지는 **온디바이스 로컬 저장**(zustand persist / secure-store) — 서버 미전송, 중간점 계산도 클라 → PIPA 경량.
- **주변(now)**: ① `src/lib/map/midpoint.ts` — centroid / 가중 중간점 **순수 좌표 로직**(haversine 재사용) + 중간점 근처 장소 추천(검색 재사용). ② `src/lib/map/recentOrigins.ts` — 최근 출발지 저장/조회(상위 2개) 로컬 store. ③ `OriginInput` UI(자동완성=장소 검색 재사용 + 최근 2개 칩). 전부 합성 입력 Jest 검증. `MapScene` kind `midpoint`/`member` 마커 산출.
- **렌더(점등)**: 중간점 핀 + 멤버(출발지) 핀.
- **PIPA 잔여**: 로컬 저장이라 동의 경량이지만 처리방침에 "출발지 온디바이스 보관" 1줄 반영(docs/privacy) — M3.

---

## 6. 순서 / 마일스톤

```
M0+① 기반 : MapScene + MapHost + isMapAvailable + MapPlaceholder + (S1)패키지 설치·NaverMapScene·조건부 플러그인
            + toScheduleScene + schedule/map placeholder→MapHost 교체  (① 가 기반을 곧 증명 → 통합)
            └ 검증: jest/typecheck/lint 그린 + 에뮬 부팅(placeholder 유지=정상). **속도 우선: S2 폴백 미계획, 불호환 시 그때 대응**
M2 ③      : 검색→확정 플로우 완성(Gate #2) + 마커 actionId 계약
M3 ④      : midpoint + recentOrigins + OriginInput  (출발지 온디바이스 저장)
M4 ②      : emphasized 마커 시각 capability + 리스트 배지  (PNG=Q-B13, 데이터=Phase 3 대기)
─ 운영 트랙(사용자) : 네이버 키 발급 → env → prebuild/EAS → 점등 검증
```

각 M은 독립 `/start-task`(TDD: 테스트 먼저 → 실패 → 구현 → 통과) + `/ship-task`.

---

## 7. 테스트 전략 (TDD 의무)

- **selector(toScheduleScene/midpoint/scene mapping)**: 순수 함수 — 합성 입력 단위 테스트(좌표·order·polyline·강조 분기).
- **MapHost**: `isMapAvailable()` mock으로 두 경로 검증 — false→`MapPlaceholder` 렌더, true→`NaverMapScene` lazy 로드(네이티브 컴포넌트는 `jest.mock`). 네이티브 SDK는 dev에서 미실행이므로 **mock 필수**.
- **화면 wire(schedule/map, tabs/map)**: 기존 testID 테스트 유지 + placeholder→MapHost 교체 후에도 그린. `isMapAvailable()` false 기본이라 기존 placeholder 단언 호환.
- **NaverMapScene 내부**(네이티브 매핑): dev/CI에서 직접 렌더 불가 → MapScene→props 매핑 로직만 분리해 단위 테스트, 실렌더는 운영 트랙 실기기.
- 금지: DB mock(LOCAL test instance), dev mode 60fps 측정.

---

## 8. 신설 결정 / 열린 질문 (구현 시 거버넌스 반영)

- **D38 — 지도 렌더 seam = `MapHost` 단일 경계 + `MapScene` 계약 + `isMapAvailable()` env 게이트(S1 설치+게이트, Kakao 조건부 플러그인 패턴 복제).** 구현 PR에서 [DECISIONS.md]에 추가 + 관련 rules(react-native.md lazy-load 항목)에 MapHost 참조. (CLAUDE.md 절대규칙 5)
- **Q-B23 — 멤버 위치 = 각자 출발지 입력 + 최근 출발지 2개 추천(온디바이스 로컬 저장).** ✅ 답 확정(본 리뷰). [OPEN_QUESTIONS.md] B 신설 시 `Closed`로 기록. 잔여: 처리방침 1줄(온디바이스 보관 고지) — M3.
- **Q-B13(기존) — 제휴 마커 PNG export.** M4 점등 에셋 의존.

---

## 9. 리스크

| 리스크 | 영향 | 완화 |
|---|---|---|
| `@mj-studio/react-native-naver-map` ↔ Expo 56/RN 0.85/React 19 호환 | M0 차단 | 설치 후 jest/typecheck/에뮬 부팅으로 즉시 확인. **속도 우선 — S2 폴백은 미리 안 짜고, 막히면 그때 전환** |
| 네이티브 패키지 top-level가 import 시 네이티브 호출 | dev 크래시 | 동적 import는 `isMapAvailable()` true에서만 실행 → dev 미로드 |
| ② Phase 3 경계 침범 | 절대규칙 6 위반 | 데이터 연동 금지, 시각 capability까지만(N3) |
| ④ 멤버 위치 부재로 범위 확대 | M3 지연 | 로직 lib만 선행, 실데이터는 Q-B23 게이트 |
| 점등 시 DESIGN 토큰 외 색 사용 | design-guard 차단 | 색·dash는 NaverMapScene에서 토큰만 |

---

## 10. 사용자 활성화 체크리스트 (운영 트랙)

1. 네이버 클라우드 플랫폼에서 **Maps Client ID** 발급 → `.env` `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` + `EXPO_PUBLIC_MAP_ENABLED=true`.
2. **Naver Local API** `NAVER_CLIENT_ID/SECRET` → Supabase Edge secrets(라이브 검색).
3. (선택) **Kakao REST key** → Edge secrets + `kakao_local_search` 배포(D37 평가 트랙).
4. `expo prebuild && expo run:android`(또는 EAS) → 실기기에서 pan/zoom/마커/60fps 검증.

---

## 11. 파일 맵

**신규**: `src/lib/map/mapScene.ts`, `src/lib/map/mapAvailability.ts`, `src/lib/map/midpoint.ts`, `src/lib/map/recentOrigins.ts`, `src/lib/schedules/scheduleScene.ts`(또는 mapScene 내), `src/components/map/MapHost.tsx`, `src/components/map/MapPlaceholder.tsx`, `src/components/map/MapLoading.tsx`, `src/components/map/NaverMapScene.tsx`, `src/components/map/OriginInput.tsx` + 각 `*.test`.
**변경**: `app/schedule/map.tsx`(placeholder→MapHost), `app/(tabs)/map.tsx`(notice/list→MapHost), `app.config.ts`(조건부 플러그인), `package.json`(패키지), `.env.example`(`EXPO_PUBLIC_MAP_ENABLED`), `app/group/[id]/place-search.tsx`·`place.tsx`(③ 확정 플로우).
**거버넌스**: `docs/DECISIONS.md`(D38), `docs/OPEN_QUESTIONS.md`(Q-B23), `docs/TASK_BACKLOG.md`(S-MAP M0~M4).

---

## 12. 리뷰 확정 사항 (2026-06-08)

- ✅ ④ Q-B23: 각자 출발지 입력 + 최근 출발지 2개 추천(온디바이스 로컬 저장).
- ✅ `MapPlaceholder`: "리스트로 보기" 유도형으로 개선(점등 전 대기창을 작동 리스트로).
- ✅ 순서: M0+① → ③ → ④ → ② (추천 유지, M0·① 통합). **안정성보다 속도·효율 우선**(사용자 지시).
- 잔여: M0 직후 에뮬 호환성 실증을 이번 세션에 run-denda로 바로 돌릴지 — 착수 시 결정.
