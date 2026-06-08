# 인수인계 — 지도 기능 M2 이후 (2026-06-08 → 다음 세션)

> 이 세션에서 **M0+①(MapHost 기반 + 동선·일정 지도)** 를 완료·검증·커밋했고, 키 세팅까지 끝냈다.
> 다음 세션은 **M2(검색→장소 확정, Gate #2)** 부터 시작한다.
> 설계 SSoT: [2026-06-08-map-feature-activation-design.md](2026-06-08-map-feature-activation-design.md)

---

## TL;DR

- ✅ M0+① DONE — branch `feat/map-maphost-m0` (commit `42e8092`), jest 933 / typecheck 0 / lint 0 errors.
- ⏭️ 다음: **M2 검색→장소 확정(Gate #2)** → M3 중간지점 → M4 제휴 마커.
- 🔑 키: `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID`만 사용자가 발급해 채우면 지도 *렌더* 점등(env + 빌드, 코드 변경 0). M2는 키 없이도 진행 가능(mock 검증).

---

## 1. 현재 상태 스냅샷

### 코드 (완료·검증됨)
- 신규: `src/lib/map/{mapScene,mapAvailability}.ts`, `src/components/map/{MapHost,MapPlaceholder,MapLoading,NaverMapScene}.tsx` + 테스트 14
- 변경: `app/schedule/map.tsx`(지도 모드 placeholder→`MapHost`, ① 동선·일정 연결), `app.config.ts`(조건부 naver 플러그인), `.env.example`/`.env.local`(`EXPO_PUBLIC_MAP_ENABLED`), `tsconfig.json`(`scripts` Deno 제외)
- 패키지: `@mj-studio/react-native-naver-map@2.9.0` 설치됨
- 거버넌스: **D38**(MapHost seam), **Q-B23** close(멤버 위치=출발지 입력+최근2개 로컬저장)

### git
- 브랜치 `feat/map-maphost-m0` = M0+① (23 files). **push 안 함 / PR 없음.**
- 작업트리에 **이전 세션 미ship 더미** 다수: S16 Kakao(+D39), S18 calendar(`CalendarDatePicker`/`monthMatrix`), `Skeleton`, `TimeGrid/VoteGuide`, `scripts/`(Deno), `tests/regression/`, `app/(tabs)/*`·`docs/ARCHITECTURE.md` 등 — **손대지 않음**.
- 커밋된 거버넌스 docs(DECISIONS·NOW·OPEN_QUESTIONS·TASK_BACKLOG·package·.env)는 일부 prior 미커밋 편집을 포함(git hunk 분리 불가).
- **다음 세션 시작 시 결정**: 이 브랜치에서 이어갈지 / `main`으로 돌아가 새로 딸지. (M2는 M0+① 위에 쌓이므로 이 브랜치 연속이 자연스러움.)

### 키 / 배포 (사용자·운영 — 미완)
| 항목 | 상태 | 필요 액션 |
|---|---|---|
| `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` | ❌ placeholder | 네이버 클라우드 **Maps** Client ID 발급 + `com.denda.app`(Android/iOS) 등록 → `.env.local`에 붙이고 `EXPO_PUBLIC_MAP_ENABLED=true` |
| 지도 네이티브 렌더 | ⏸️ | 위 키 후 `expo prebuild && expo run:android`(또는 EAS) |
| `NAVER_CLIENT_ID`/`SECRET` (Edge) | ✅ 등록됨 | 추가 불필요 |
| `naver_local_search` Edge 함수 | ❌ 미배포 | `supabase functions deploy naver_local_search` (라이브 검색용) |
| Kakao Local | ⛔ 심사 반려(D39) | Naver primary 확정 → 추가 액션 없음. Kakao 자산 dormant 보존 |
| ⚠️ 원격 Edge 함수 | `kakao_local_search`만 ACTIVE | 백엔드 전반 미배포 — **지도와 별개**, 따로 점검 권장 |

---

## 2. M2 시작 방법

1. 프로젝트 정책 읽기: `CLAUDE.md` → `docs/NOW.md` → `docs/SESSION_LOG.md`(최근) → spec(§5 ③ + §6 순서).
2. 관련 기존 코드: `app/group/[id]/place-search.tsx`(useMapSearch 재사용), `app/group/[id]/place.tsx`(PlaceActionSheet/확정), `src/lib/places/useMapSearch.ts`, `MapScene.actionId` 계약(`src/lib/map/mapScene.ts`).
3. `/start-task S-MAP M2` 로 진입(TDD 강제).
4. **M2 Acceptance (검색→장소 확정, Gate #2):**
   - 검색 결과 → 모임 장소 확정 플로우(리스트에서). **더블탭 idempotent — "예약하기 click 정확도" critical path(testing rule)**.
   - `MapScene` 마커 `actionId`로 동일 확정 액션을 정의(점등 시 마커 onPress → 동일 라우팅 `/group/[id]/place`).
   - 키 없이 mock 데이터로 Jest 검증.
5. 경계 주의: ④는 Q-B23(출발지 직접 입력 + 최근 2개 칩, **온디바이스 로컬 저장**), ②는 partnership=**Phase 3(D3) 금지** → 시각 capability까지만.

---

## 3. 이 세션에서 배운 것 (재현 방지)

- **`isMapAvailable()`**: `process.env.EXPO_PUBLIC_*`를 정적 멤버 접근(빌드 인라인 보존) + 테스트는 `MapEnv` 주입(DI)으로 검증. 런타임 env mutation 의존 금지.
- **`React.lazy` + react-test-renderer**: 동적 import mock이 까다로움(unmount/act 에러). MapHost 검증은 **"available 분기 = Suspense fallback(`map-loading`) 동기 렌더 + placeholder 부재"** 로 처리하고, 네이티브 패키지는 `jest.mock('@mj-studio/react-native-naver-map')` stub. 실 native 렌더는 EAS만(CI 검증 대상 아님).
- **jest.mock 팩토리**의 `require`는 hoisting상 불가피 → 파일 상단 `/* eslint-disable @typescript-eslint/no-require-imports */`.
- **`scripts/`(Deno)** 는 `tsconfig.json` exclude에 추가됨(`supabase/functions` 선례). eslint는 여전히 scripts/ 경고(전부 기존, 0 errors).
- **app.config 네이버 플러그인 prop** = `{ client_id }` → 플러그인이 `NMFNcpKeyId`/`NMFClientId`(iOS) + Android manifest meta 주입. 키 없으면 플러그인 미포함(현 빌드 무영향).

---

## 4. 다음 세션 붙여넣기 프롬프트

```
지도 기능 로드맵을 이어서 진행하자. 지난 세션에 M0+①(MapHost 기반 + 동선·일정 지도)을
완료·커밋했고(branch feat/map-maphost-m0), 이번엔 M2(검색→장소 확정, Gate #2)를 한다.

먼저 읽을 것:
- docs/superpowers/specs/2026-06-08-map-m2-handoff.md (인수인계 — 현재 상태·M2 방법·주의)
- docs/superpowers/specs/2026-06-08-map-feature-activation-design.md (설계 SSoT, §5 ③ + §6)
- CLAUDE.md + docs/NOW.md + docs/SESSION_LOG.md(최근)

그다음 /start-task 로 S-MAP M2 진입(TDD). M2 = 검색 결과 → 모임 장소 확정 플로우
(리스트에서, 더블탭 idempotent — Gate #2 click 정확도) + MapScene.actionId로 마커 확정
액션 통일. 키 없이 mock 검증. branch는 feat/map-maphost-m0 위에서 이어가면 됨.

참고: 지도 *렌더* 점등은 네이버 Maps Client ID 발급(사용자) + EAS 빌드가 게이트라
M2와 무관하게 따로 진행됨. ②는 Phase 3 경계(시각 capability만), ④는 Q-B23(출발지 입력).
```
