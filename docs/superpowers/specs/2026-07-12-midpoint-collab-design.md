# S-MAP M5 — 중간지점 협업 업그레이드 (멤버 출발지 + 역 스냅 + 자동 추천)

> 2026-07-12 브레인스토밍 확정 스펙. 기존 M3 중간지점(호스트 단독 입력·산술 중심·수동 검색)을
> "모임 멤버 각자가 출발지를 등록하면, 대략적 중간지점(가까운 지하철역)과 만날 장소를
> 검색 없이 자동 추천"으로 업그레이드한다.
>
> 관련: [D38 MapHost seam](../../DECISIONS.md#d38--지도-렌더-seam--maphost-단일-경계--mapscene-계약--ismapavailable-env-게이트) ·
> [D39 Naver primary](../../DECISIONS.md#d39--장소-검색-primary--naversearchprovider-확정-kakao-local-보류-카카오맵-심사-반려) ·
> Q-B23(온디바이스 출발지 — 본 스펙의 **D41이 supersede**) ·
> 선행 스펙 [2026-06-08 map-feature-activation](2026-06-08-map-feature-activation-design.md) (M0~M4)

---

## §0 배경 · 문제

M3 중간지점 화면(`app/group/[id]/midpoint.tsx`)의 현재 한계 3가지:

1. **호스트 혼자 입력** — 멤버들 출발지를 호스트가 손으로 전부 대신 입력. 멤버 참여 없음.
2. **검색어를 쳐야만 추천** — 네이버 지역검색 API가 좌표 기반 주변검색을 미지원 →
   키워드 검색 결과를 거리순 재정렬만 함. 검색어 0 = 추천 0.
3. 출발지 온디바이스 저장(Q-B23) — 멤버 간 공유가 구조적으로 불가능.

**사용자 확정 요구 (2026-07-12 Q&A)**:

| 질문 | 확정 답 |
|---|---|
| 업그레이드 핵심 | ① 멤버 각자 출발지 입력 + ② 검색 없이 자동 추천 (둘 다) |
| 자동 추천 결과물 | 지역(역) + 구체 장소 둘 다 — "○○역 근처가 중간" + 그 역 기준 장소 리스트 |
| 출발지 서버 저장 | 라벨+정확 좌표 그대로 저장 + RLS(모임 멤버만) + cascade 삭제 |
| 미입력 멤버 | 입력한 사람만으로 진행 (2명 이상부터 계산, "n/m명 입력" 표시, 전원 대기 없음) |

**v1 제외 (YAGNI, 사용자 합의)**: GPS "현재 위치로 등록"(expo-location 신규 의존) ·
출발지 요청 푸시 알림 · 대중교통 소요시간 균형점(외부 API) · Realtime 실시간 반영(focus refetch로 충분, v2 후보) ·
시간 확정 전 출발지 등록(진입점은 기존 위치 유지).

---

## §1 데이터 모델 — `supabase/migrations/0023_group_origins.sql`

```sql
CREATE TABLE public.group_origins (
  group_id   UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label      TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100),
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)   -- 1인 1출발지. 수정 = upsert
);
```

- FK는 0001의 `public.users` 패턴을 따른다 (구현 시 0001 실제 FK 대상 재확인).
- 좌표는 클라에서 `normalizeWgs84`(D18) 통과 후 저장. DB CHECK는 기본 범위만 (한국 bbox 강제는
  클라·Edge에 이미 있음 — DB까지 3중 강제는 과잉).
- `updated_at`은 upsert 시 클라가 갱신(트리거 불필요 — 단일 writer가 본인 행뿐).

**RLS** — 0022 SECURITY DEFINER 헬퍼 재사용 (self-EXISTS 재귀 금지, 0022 전례):

| 정책 | 조건 |
|---|---|
| SELECT | `(is_group_member(group_id, auth.uid()) OR is_group_host(group_id, auth.uid()))` **AND** `(auth.uid() = user_id OR NOT is_blocked(auth.uid(), user_id))` — D16 |
| INSERT | `auth.uid() = user_id` AND `(is_group_member(...) OR is_group_host(...))` |
| UPDATE | `auth.uid() = user_id` (USING + WITH CHECK) |
| DELETE | `auth.uid() = user_id` |

- 호스트가 group_members에 없을 수 있으므로 모든 정책에 `OR is_group_host` 병기 (0022 §2 패턴).
- 타인 출발지 대리 입력 불가 = INSERT `auth.uid() = user_id`가 강제 (미입력 정책 "입력한 사람만" 확정과 일치).
- 모임 삭제·멤버 탈퇴 시 cascade로 출발지 자동 소거 (별도 정리 코드 0).

## §2 지하철역 정적 데이터 + 역 스냅 — `src/lib/map/stations*.ts`

**데이터**: `src/lib/map/stations.data.ts` — 전국 도시철도 역 좌표 배열 `{ name, lat, lng }[]`.

- 출처: 공공데이터포털 "전국도시철도역사정보표준데이터" (공공누리 — 상업 이용 가능, 파일 헤더에 출처 주석).
- 생성: `scripts/generate-stations.mjs` — 내려받은 표준 CSV를 파싱해 TS 모듈 출력. 리포에 스크립트 보존(재생성 가능).
  - **환승역 dedup**: 역명(호선 표기 제거) 기준 group-by → 좌표 산술 평균 1건.
  - 역명 정규화: 괄호 병기 제거(예: "서울역(1호선)" → "서울역"), 표시명은 끝이 "역"이 아니면 "역" 접미(예: "강남" → "강남역").
  - 좌표는 한국 bbox(32.5~39.0 / 124.0~132.5) 밖이면 제외 (naver_local.ts와 동일 안전망).
- 규모: 전국 ~1,000역 · 번들 +~50KB (cold start 영향 무시 가능 수준 — D25 always-load 아님,
  midpoint 화면 모듈 그래프에서만 당겨짐).

**역 스냅**: `src/lib/map/stationSnap.ts` (순수 함수, 키 0, 전부 Jest)

```ts
STATION_SNAP_MAX_METERS = 3000;
nearestStation(coord: Wgs84Coord): { name: string; coord: Wgs84Coord; distanceMeters: number } | null
```

- `haversineMeters` 선형 스캔 (1,000건 × O(1) — 성능 무시 가능). 동률은 배열 앞쪽 승 (deterministic).
- 3km 초과 → `null` → **폴백**: 역 카드·자동 추천 생략, 기존 산술 중점 마커 + 수동 검색 유지 (교외 모임).

**마커 규칙**: 스냅 성공 시 scene의 emphasized `midpoint` 마커를 **역 좌표 + "○○역" 라벨로 대체**
("대략적 중간지점 = 역" 개념 일치, emphasized 마커는 항상 1개). 폴백 시 기존 산술 중점 마커.
`toMidpointScene` 시그니처는 `midpoint: Wgs84Coord | null` 그대로 두고 호출부가 역/중점 좌표·라벨을 주입
(라벨 파라미터 1개 추가 — 기존 '중간지점' 기본값 유지로 하위호환).

## §3 자동 추천 (검색 0타) — `src/lib/map/autoRecommend.ts`

- **자동 쿼리 빌더**: `buildAutoQuery(stationName, category)` → `"강남역 맛집"` 형태 순수 함수.
- **카테고리 칩**: `맛집`(기본 선택) · `카페` · `술집`. 칩 전환 = 쿼리 재발사.
- 발사 경로: 역 스냅 성공 시 `useMapSearch.setQuery(buildAutoQuery(...))` — 기존
  debounce(400ms)·ViewportCache(5분)·에러 경로·`naver_local_search` Edge(배포 완료 확인, 2026-07-12) 전부 재사용.
  **신규 Edge Function 0 · 신규 외부 API 0.**
- 정렬: 스냅 성공 시 `sortByDistanceTo(results, 역 좌표)`, 폴백 시 기존대로 산술 중점 기준.
- **수동 검색 공존**: 검색창 직접 입력 시 칩 선택 해제(수동 모드) — 자동 추천이 마음에 안 들 때 기존 동작 그대로.
  칩 다시 탭 = 자동 모드 복귀.
- 네이버 지역검색 한계로 결과 최대 5건/쿼리 — 칩 3개가 사실상 카테고리별 "더 보기" 역할.

## §4 클라 데이터 모듈 — `src/lib/map/groupOrigins.ts`

```ts
interface GroupOrigin { userId: string; nickname: string; label: string; coord: Wgs84Coord; }
fetchGroupOrigins(groupId): Promise<GroupOrigin[]>   // users(nickname) join — 멤버 리스트 fetch와 동일 패턴
upsertMyOrigin(groupId, origin: OriginPoint): Promise<void>  // onConflict (group_id,user_id)
deleteMyOrigin(groupId): Promise<void>
```

- 에러는 기존 `mapError` 한국어 카피 패턴으로 surface. supabase client는 Jest mock (기존 queries.ts 관례).
- 멤버 수(n/m의 m)는 group_members count 조회 — group index 화면의 기존 멤버 fetch 패턴 재사용.

## §5 화면 플로우 — `app/group/[id]/midpoint.tsx` 개편 (신규 화면 0)

1. **진입/focus 시 refetch**: `fetchGroupOrigins` + 멤버 수 (W2-5 focus refetch 패턴, Realtime 없음).
2. **"내 출발지" 섹션**: OriginInput(기존 재사용, recentOrigins 온디바이스 칩 유지) →
   `upsertMyOrigin` → 성공 시 로컬 반영. 내 출발지 칩만 삭제(X)·재선택으로 수정 가능.
3. **멤버 출발지 리스트**: 타인 행은 읽기 전용 "닉네임 · 라벨". 마커 라벨은 장소 라벨(기존 member kind).
4. **진행 표시**: "3/5명 입력" — 등록 수/전체 멤버 수. m(전체)은 group index 화면의 멤버 수
   표기 관례를 따른다(호스트가 group_members에 없으면 +1 포함). **2명 이상이면 즉시**
   중간지점→역 스냅→자동 추천 표시. 전원 대기 없음, 미입력자는 계산에서 제외.
5. **역 카드**: "**○○역 근처가 중간이에요** · 중간지점에서 350m" + 카테고리 칩 + 추천 리스트(§3).
6. **확정**: 기존 그대로 — 추천/마커 탭 → ConfirmSheet → `usePlaceConfirmAction`(더블탭 lock) →
   Gate #1·#2 **무변경 (불가침)**.
7. **진입점 변경** `app/group/[id]/index.tsx`: "중간지점으로 찾기" 버튼 **호스트 전용 → 전 멤버 노출**.
   장소 확정 CTA·RLS(host-only setConfirmedPlace)는 무변경.
8. **개인정보 고지 개정 (법적 P0)** `app/(auth)/privacy.tsx:81-83`: "마. 기기 내 보관(서버 미전송)" 문구를
   이원화 — (a) 모임 출발지: 서버 저장, 모임 멤버에게만 공개, 모임 삭제/탈퇴 시 삭제,
   (b) 최근 출발지 칩: 기기에만 저장. `midpoint.ts`·`midpoint.tsx` 상단 주석의 "서버 미전송" 문구도 일괄 갱신.

**상태별 UI**: 출발지 0~1개 = 안내 카피("출발지를 등록해주세요 · 2명 이상 모이면 중간지점을 찾아드려요") ·
로딩 = 기존 Spinner/Skeleton 패턴 · fetch 실패 = EmptyState error + 재시도 · upsert/삭제 실패 = error Toast ·
자동 검색 실패 = 기존 에러 경로(결과 보존 + 재시도) · 비멤버 = RLS 0 rows (진입 버튼 자체가 멤버 화면에만 있음).

## §6 결정 기록 — D41 (구현 첫 커밋에 포함)

- **D41 — 모임 출발지 서버 저장 (Q-B23 부분 supersede)**: 멤버 협업 취합을 위해 모임 스코프
  `group_origins` 테이블에 라벨+정확 좌표 저장. 보호선 = RLS(모임 멤버만·D16 차단 통과·본인만 쓰기) +
  cascade 삭제 + privacy 고지 개정. recentOrigins(최근 칩)는 여전히 온디바이스 — Q-B23의 해당 부분은 유지.
- DECISIONS.md 새 D41 + OPEN_QUESTIONS Q-B23에 `부분 supersede by D41` 표기.

## §7 테스트 (TDD — 전부 테스트 먼저, 실패 확인 후 구현)

| 대상 | 테스트 |
|---|---|
| `stations.data.ts` | sanity: 전 좌표 한국 bbox 안 · 역명 중복 0 · 표시명 "역" 접미 |
| `stationSnap.ts` | 최근접 선택 · 3km 초과 null · 빈 데이터 null · 동률 결정성 |
| `autoRecommend.ts` | 쿼리 조합 · 카테고리 3종 |
| `groupOrigins.ts` | upsert onConflict 인자 · fetch join shape · delete · 에러 한국어 surface (supabase mock) |
| `midpoint.tsx` 화면 | 등록→upsert 호출 1회 · "n/m명" 표시 · 2명 미만 안내/2명 이상 역 카드 · 칩 전환 재검색 · 수동 입력 시 칩 해제 · 타인 출발지 읽기 전용 · 3km 폴백 · 확정 플로우 회귀(기존 테스트 유지) |
| 진입점 | group index: 멤버 계정에도 중간지점 버튼 노출 |
| 회귀 | 기존 midpoint·place-search·Gate #2 테스트 전량 그린 유지 |

RLS 자체는 Supabase LOCAL 검증(마이그레이션 push 후 0022 스타일 수동 검증 쿼리를 마이그레이션 말미 주석으로 동봉).

## §8 수용 기준

1. 멤버 A·B가 각자 출발지 등록 → 서로의 출발지가 보이고 "2/N명 입력" 표시.
2. 2명 등록 즉시 역 카드 + "○○역 맛집" 자동 추천 리스트가 검색어 입력 없이 뜬다.
3. 중간지점이 모든 역에서 3km 초과면 역 카드 없이 기존 수동 검색 동작.
4. 타인 출발지는 수정·삭제 불가(UI에 없음 + RLS 거부), 모임 삭제 시 출발지 소거.
5. 호스트가 추천 장소 확정 → 기존 place 라우트·Gate #1·#2 로깅 동작 불변.
6. privacy 화면이 서버 저장을 정확히 고지.
7. Jest·tsc·eslint·design-guard 전량 그린, 기존 1211 테스트 회귀 0.

## §9 비목표 (명시적 제외)

- GPS 현재 위치 등록 · 출발지 요청 푸시 · 대중교통 시간 균형점 · Realtime 반영 ·
  시간 확정 전 등록 · 지도 탭 MapHost 교체(별건) · 제휴 실데이터(Phase 3 불변).

## §10 리스크 · 완화

| 리스크 | 완화 |
|---|---|
| 표준데이터 CSV 좌표 품질(TM/WGS 혼재 이력) | 생성 스크립트에서 bbox 필터 + sanity 테스트가 CI에서 상시 검증 |
| "○○역 맛집" 검색 품질이 지역마다 들쑥 | 칩 3종 + 수동 검색 공존으로 dead-end 없음 |
| privacy 고지 누락 시 법적 리스크 | §5-8을 구현 태스크에 포함(별도 후속 아님) — 마이그레이션과 같은 마일스톤 |
| RLS 재귀 재발 | self-EXISTS 금지, 0022 헬퍼만 사용 (스펙 §1에 고정) |

## §11 파일맵

**신규**: `supabase/migrations/0023_group_origins.sql` · `src/lib/map/stations.data.ts` ·
`src/lib/map/stationSnap.ts`(+test) · `src/lib/map/autoRecommend.ts`(+test) ·
`src/lib/map/groupOrigins.ts`(+test) · `scripts/generate-stations.mjs` · `src/lib/map/stations.data.test.ts`

**변경**: `app/group/[id]/midpoint.tsx`(+화면 테스트) · `app/group/[id]/index.tsx`(버튼 노출) ·
`app/(auth)/privacy.tsx`(고지) · `src/lib/map/midpoint.ts`(toMidpointScene 라벨 파라미터, 주석) ·
`docs/DECISIONS.md`(D41) · `docs/OPEN_QUESTIONS.md`(Q-B23 표기)

**무변경 (불가침)**: `usePlaceConfirmAction`·click_log·Gate 로깅 · MapHost/NaverMapScene ·
NaverSearchProvider/Edge · D12 워클릿 영역 전체.
