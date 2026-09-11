# 여정 척추(Journey Spine) 로드맵 — 설계 문서

> **작성일**: 2026-05-28
> **유형**: 종합 로드맵 (A~D 갭 순서화). 각 클러스터는 별도 spec/plan/구현 사이클로 분할.
> **상태**: 설계 승인 대기 → 승인 시 첫 클러스터(척추 S18·S19) writing-plans로 전환.

---

## 1. 문제 정의

기능 태스크(S00~S17)는 12/17 정식 DONE이지만, 그 기능들을 **하나의 걸을 수 있는 유저 여정으로 잇는 "척추(spine)" 태스크가 백로그에 없다.** 결과적으로 핵심 화면들이 다 구현돼 있으나 *앱 안에서 도달 불가능한 섬*으로 떠 있다.

### 근본 원인

1. 백로그가 **Lane(A 기반/그리드, B 지도, C 웹, D 크로스컷) = 수평 기능 슬라이스**로만 분해됨. "유저가 A→B→C를 걷는다"를 책임지는 수직(여정) 태스크 부재.
2. Acceptance가 전부 **기능 단위**("그리드 60fps", "클릭 idempotent")지 여정 단위("모임을 만들어 그리드까지 도달")가 아님. 각 태스크가 *"standalone ready, 마커 trigger는 S10 unblock 후 1줄"*, *"임시로 supabase dashboard로 group_id 확보"* 식으로 연결 책임을 옆 태스크로 떠넘기며 정직하게 DONE 처리됨.
3. 결과: **"70.6% DONE"은 기능 기준으론 진실이나, 걸을 수 있는 제품 기준으론 ~0%.** 베타의 존재 이유인 Gate #1·#2를 만들어내는 화면들이 도달 불가라 측정 자체가 불가능.

---

## 2. 갭 인벤토리 (전수 조사 결과)

코드로 검증한 전체 미구현·미연결 목록.

### A. 여정 척추 (happy path 직접 차단 — 신규 작업, S10 무충돌)
| # | 갭 | 현재 상태 |
|---|---|---|
| 1 | 모임 생성 | 화면·`createGroup` lib·후보날짜 선택·FAB 전부 없음. 홈 CTA `app/(tabs)/index.tsx:77` = `/* TODO */`, 친구탭 `onMakeGroup` = `Alert("모임을 만듭니다")` 스텁 |
| 2 | 내 모임 리스트 | 홈 "다가오는 모임" `upcomingCount=0` 하드코딩, `fetchMyGroups` 없음 |
| 3 | 그리드 화면 진입 네비 | `router.push('/group/[id]')` 앱 전체 0건 → S05 그리드 도달 불가 |

### B. "DONE이지만 실제로는 mock/dead" (척추 일부 차단)
| # | 갭 | 현재 상태 |
|---|---|---|
| 4 | 친구 시스템 DB 미연동 | S07 "DONE"이나 `src/lib/friends/api.ts` 전체 in-memory mock(목록·검색·요청·수락). 차단만 실 supabase |
| 5 | 인앱 모임 초대 / 합류 | `group_invitations` 테이블만 존재. 클라 API·UI 없음. `group_members` INSERT는 deeplink 전환(attribution_resolve)에서만 → 초대 수락→합류 경로 없음 |
| 6 | 푸시 F1/F2/F3 publisher | S12에서 "friends/invitations API supabase 전환" prereq로 막힘 (#4·#5 의존) |

### C. 게이트 완성에 필요하나 S10과 엮임
| # | 갭 | 현재 상태 |
|---|---|---|
| 7 | 확정 → 장소 → 예약클릭 | 확정화면이 `confirmedPlaceId:null` 고정, place로 이동 안 함. place 화면은 지도 마커(S10)로만 진입 설계 |

### D. 부차적 dead-end (게이트 무관, 최하 우선)
- 프로필 설정행 3개(알림설정/신고차단관리/화면모드) onPress 없음, 홈 알림 버튼 dead, 친구탭 카톡초대 가짜 Alert, 지도-일정 모드(S15-mapmode, S10 의존)

### 핵심 통찰

이미 동작하는 **웹게스트 링크(S14 DONE) + 딥링크(S15 DONE)** 가 있어, 친구 API(#4·#5) 없이도 "호스트가 모임 생성 → 카톡 링크 공유 → 친구가 웹에서 투표 → 호스트가 히트맵 보고 확정"이라는 **멀티유저 루프가 #1·#2·#3만 채우면 성립**한다. 즉 척추의 최소 버전은 S10·친구 API 둘 다 안 건드리고 가능하다.

---

## 3. 범위·전략 결정 (브레인스토밍 합의)

- **범위**: 종합 로드맵 (A~D 전부 순서화). 지금 당장 구현보다 "무엇을 언제" 큰 그림 우선. 각 클러스터는 별도 spec/plan으로 분할.
- **순서 최적화 = 게이트 측정 최단.** 베타의 존재 이유가 Gate #1·#2 측정이므로, 척추(A) 직후 게이트 경로(C)를 우선한다. **S10 지도 렌더에 의존하지 않고**, 이미 DONE된 S16 `NaverSearchProvider`로 "지도 없는 장소 검색/선택" 경로를 만들어 게이트를 S10과 **디커플링**한다. 사회적 루프(B)는 웹게스트 링크로 대체 가능하므로 병행/후순위.
- **S20의 trade-off 수용**: "지도 없는 장소 검색"은 S10의 지도 기반 장소 선택과 **영구 공존하는 두 번째 진입 경로**다. (둘 다 같은 `place.tsx` + `click_log`로 수렴.)

---

## 4. 태스크 분해 (S18~S24, 신규 Lane E — Journey/Glue)

기존 Lane A~D는 능력 기반이라 DONE 카운트를 정직하게 유지하기 위해, 연결 작업은 **새 Lane E**로 분리한다.

### 트랙 1 — 게이트 임계경로 (S10 무충돌)

#### S18 — 모임 생성 flow
- **Depends**: S00(groups/group_members/dates DATE[] + invite_code 트리거 0016), S05(생성 후 진입 대상 그리드), D13(KST)
- **Acceptance**:
  - `src/lib/groups/create.ts::createGroup({name, dates})` → `groups` INSERT(host_id=auth.uid, name, dates DATE[]) + `group_members` INSERT(host) **atomic**. invite_code는 BEFORE INSERT 트리거 자동. returns `{id}`.
  - `app/group/new.tsx`: 모임 이름 TextInput + 후보 날짜 다중 선택(최대 7일 — 그리드 7열 정합, luxon `Asia/Seoul`) + brand-500 "모임 만들기" CTA 1개(§17 anti-AI-feel). 한국어. 유효성(이름 1+자, 날짜 1+개) 한국어 에러.
  - 진입점 실연결: 홈 CTA(`app/(tabs)/index.tsx:77` TODO 제거) → `router.push('/group/new')`. 친구탭 `handleMakeGroup`도 동일 진입(베타: 멤버 사전선택 없이 생성 후 링크 공유).
  - 생성 성공 → `router.replace('/group/${id}')`(그리드 진입). 실패 한국어 Alert.
- **Files**: `app/group/new.tsx`, `src/lib/groups/create.ts(.test.ts)`, `app/(tabs)/index.tsx`(CTA 1줄), `app/(tabs)/friends/index.tsx`(handleMakeGroup 1줄), (옵션 `supabase/migrations/00XX_create_group_rpc.sql` — atomic 보장)
- **클러스터 spec에서 결정**: 후보 날짜 선택 컴포넌트 형태(달력 multi-select vs 주 단위), atomic 방식(RPC vs 2-step + 보상 트랜잭션).

#### S19 — 내 모임 리스트
- **Depends**: S00(groups RLS = host_id ∨ group_members), S18, D13
- **Acceptance**:
  - `src/lib/groups/list.ts::fetchMyGroups()` → groups SELECT(RLS 자연: host 또는 멤버). 정렬: 미확정 먼저/최근. name·dates·confirmed_at·memberCount 반환.
  - 홈 "다가오는 모임" 섹션 실데이터(`upcomingCount` 하드코딩 제거). 항목 카드 → `router.push('/group/${id}')`. 빈 상태 §11.2 유지.
  - TDD: list.ts(RLS query shape, 정렬, 빈 결과), 홈 화면(리스트 렌더→탭→navigate).
- **Files**: `src/lib/groups/list.ts(.test.ts)`, `app/(tabs)/index.tsx`(섹션 교체)
- **클러스터 spec에서 결정**: "다가오는" 정의(확정+미래 vs 전체 active), 페이지네이션(베타 소량 → 불필요).

#### S20 — 지도 없는 장소 검색·선택 ★게이트
- **Depends**: **S16 ✅**(NaverSearchProvider + Edge `naver_local_search`), **S08 ✅**(PlaceActionSheet + `place.tsx` + `click_log`), S04/S05(확정), [G1](../../DECISIONS.md), [G2](../../DECISIONS.md), D18(좌표)
- **Acceptance**:
  - `app/group/[id]/place-search.tsx`(신규 라우트): 텍스트 검색 input → `NaverSearchProvider.search()` → 결과 리스트(이름/카테고리/주소). 선택 → 장소 영속화 + `groups.confirmed_place_id` UPDATE(**= 장소 확정 = Gate #1 이벤트**) → `/group/[id]/place?placeId=...`(S08) navigate.
  - 확정 화면(`app/group/[id]/index.tsx`)에 확정 후 호스트 "장소 정하기" 버튼 → place-search 진입.
  - PlaceActionSheet "예약하기" → `logReservationClick`(**Gate #2**, S08 기존).
  - 한국어·DESIGN 토큰·KST. TDD: place-search 화면(검색→선택→confirmed_place_id UPDATE→navigate), 영속화 lib.
- **Files**: `app/group/[id]/place-search.tsx`, `src/lib/places/persist.ts(.test)`, `src/lib/groups/setConfirmedPlace.ts(.test)`, `app/group/[id]/index.tsx`("장소 정하기" 버튼), **가능 시 `supabase/migrations/00XX_places_provider.sql`** (places.kakao_place_id nullable + provider_place_id/source 보강 — S16 노트가 이미 플래그)
- **클러스터 spec에서 결정**: places 영속화 스키마(보강 vs 신규 컬럼), "장소 확정" 공식 신호 = confirmed_place_id 확정, 장소 확정 시점(선택 즉시 vs 확인 단계).

### 트랙 2 — 사회적 루프 (병행 가능, 후순위 — 웹게스트가 멀티유저 대체)

#### S21 — 친구 시스템 실DB 전환
- **Depends**: S00(friendships, friend_requests, blocks), D16(`is_blocked` helper — 모든 친구 SELECT 통과)
- **Acceptance**: `src/lib/friends/api.ts` mock → supabase 전면 교체(list/search/sendRequest/accept/reject/cancel/remove). search·list는 `is_blocked` 통과(D16). 시그너처 유지 → 친구탭/검색/요청 UI 무변경. **S07을 PARTIAL로 재마킹**(정직성) + SESSION_LOG 기록. TDD(supabase mock + RLS·blocking 통과).
- **Files**: `src/lib/friends/api.ts`(전면 교체), `.test.ts`, (필요 시 friend_requests RLS 보강 migration), `docs/TASK_BACKLOG.md`·`SESSION_LOG.md`(S07 status)

#### S22 — 인앱 모임 초대 / 합류
- **Depends**: S21, S00(group_invitations + group_members + RLS 0005), D16, [D31](../../DECISIONS.md)
- **Acceptance**: `src/lib/groups/invitations.ts`(createInvitation INSERT status=pending + listMyInvitations + acceptInvitation → group_members INSERT atomic·idempotent + status update). 초대 UI(모임/생성에서 친구 선택→초대). 초대함 진입 + 수락 → 합류 → `/group/[id]`. 차단 사용자 초대 hidden(D31). TDD.
- **Files**: `src/lib/groups/invitations.ts(.test)`, 초대 UI 컴포넌트/화면, (RLS 0005 기존)

#### S23 — 푸시 F1/F2/F3 publisher wire-up
- **Depends**: S21·S22, **S12 ✅**(notify_f1/f2/f3 handler + dispatcher), D33
- **Acceptance**: friends sendRequest→`dispatch(friend_requested→F1)`, accept→`dispatch(friend_accepted→F2)`. invitations createInvitation→`dispatch(group_invited→F3)`. 각 notify_f{1,2,3} handler register. TDD(dispatch 호출 검증).
- **Files**: `src/lib/friends/api.ts`·`src/lib/groups/invitations.ts`(dispatch 추가), Edge handler register, 테스트

### 트랙 3 — 부차적 (최하 우선)

#### S24 — dead-end 정리
- **Depends**: 없음(독립)
- **Acceptance**: 프로필 설정행(알림설정/신고차단관리/화면모드) 실제 화면 or 베타 비활성 명시. 홈 알림 버튼(알림센터 화면 or 비활성). 친구탭 카톡초대 실제 share(S08 `kakaoShare` 재사용). 게이트 무관, 일부 P1(차기) 이연 가능.
- **Files**: profile 관련, `app/(tabs)/index.tsx`(알림), `app/(tabs)/friends/index.tsx`(초대)

---

## 5. 순서 + 의존성 그래프

```
[현재 DONE: S00 인프라 · S05 그리드 · S08 place.tsx+click_log · S14 웹게스트 · S15 딥링크 · S16 검색]
         │
   ┌─────▼─────────────────────────── 트랙 1 (게이트 임계경로, S10 무관) ───┐
   │  S18 모임생성 ──▶ S19 모임리스트 ──▶ S20 장소검색·선택              │
   │  (첫 walkable)    (그리드 도달)      (★ Gate #1·#2 측정 가능)         │
   └────────────────────────────────────────────────────────────────────┘
         │ (병행 가능, 임계경로 아님)
   ┌─────▼─────────────────────── 트랙 2 (인앱 사회 루프) ──────────────┐
   │  S21 친구 실DB ──▶ S22 인앱 초대/합류 ──▶ S23 F1-F3 푸시           │
   └────────────────────────────────────────────────────────────────────┘
         │
   ┌─────▼─── 트랙 3 (마지막) ───┐
   │  S24 부차적 dead-end 정리   │
   └────────────────────────────┘

[S10 (진행 중, 별개 트랙)] ──▶ 랜딩 시 지도 마커→place.tsx 라는 *두 번째* 장소 진입 경로 추가.
                                S20의 검색 경로와 공존 (둘 다 같은 place.tsx + click_log로 수렴)
```

**임계 경로 = S18 → S19 → S20.** 이 3개만 끝나면 S10·친구 API 없이도 베타 핵심(Gate #1·#2 측정)이 성립한다. 트랙 2·3은 병행/후순위.

---

## 6. S10·기존 DONE 무충돌 보장

- **S20은 새 라우트 `/group/[id]/place-search`** 를 추가하고, 선택 후엔 S08의 기존 `/group/[id]/place`로 navigate. S10이 건드리는 지도탭(`app/(tabs)/map.tsx`)·`src/lib/places/*`·마커 wire-up을 **전혀 안 만짐**. S10 랜딩 시 마커→place도 켜져 장소 진입이 "검색 / 지도" 두 경로(충돌 0).
- **S18·S19는 `app/group/new.tsx`·`src/lib/groups/{create,list}.ts`(신규) + 홈/친구탭 stub 함수 본문만** 수정 → 기존 DONE 파일 미변경.
- **git 확인**: S10 worktree/브랜치 미존재(커밋된 S10 작업 0건). S10은 미커밋 진행 중으로 간주하고 지도 영역 미접촉.

---

## 7. 정직성 수정 (하네스 "정식 DONE" 원칙 정합)

- **S07(친구)은 "DONE"이나 데이터가 mock** → S21에서 실DB 전환하며 **S07을 PARTIAL로 재마킹**. TASK_BACKLOG + SESSION_LOG에 사유 명시.
- (참고) S08의 "마커 탭→바텀시트" acceptance는 S10 마커 wire-up 전제로 close됐으나, S20이 별도 진입 경로를 제공하므로 게이트 측정은 S10과 무관하게 성립.

---

## 8. 절대 규칙 준수 체크 (모든 클러스터 공통)

- **TDD 의무**: 각 태스크 테스트 먼저 → 실패 확인 → 구현.
- **DESIGN 토큰만**: hex/그라데이션/glassmorphism 금지, brand-500은 의미 있을 때만, §17 anti-AI-feel.
- **KST 강제**: `new Date()` 직접 금지, luxon `Asia/Seoul`. 후보 날짜·확정 시각 전부 KST.
- **한국어 UI only**.
- **RLS + is_blocked**: 친구·멤버·초대 모든 SELECT가 D16 helper 통과.
- **🔒 Phase 3 금지**: 결제·reservations/payments/payouts·F6/F7 미작성. S20은 "예약하기 클릭 로깅"까지만(결제 X).
- **secret 서버 only**: Naver 검색 secret은 Edge proxy(S16 기존).

---

## 9. 미해결 sub-decision (각 클러스터 spec 진입 시 closure)

| 클러스터 | 결정할 것 |
|---|---|
| S18 | 후보 날짜 선택 UX(달력 multi-select vs 주 단위) · atomic 생성 방식(RPC vs 2-step) |
| S19 | "다가오는 모임" 정의(확정+미래 vs 전체 active) |
| S20 | places 영속화 스키마(kakao_place_id nullable + provider_place_id 보강) · 장소 확정 공식 신호 |
| S22 | 초대 진입 위치(생성 화면 내 vs 모임 화면 내) · 초대함 화면 위치 |
| S24 | 각 dead-end를 구현 vs 베타 비활성 vs P1 이연 |

---

## 10. 다음 단계

1. 이 spec 승인.
2. **첫 클러스터 = 척추(S18·S19)** writing-plans로 전환 → 구현 계획 수립.
3. S20(게이트 경로)은 S18·S19 완료 후 별도 spec/plan.
4. 트랙 2·3은 트랙 1 진행과 병행 가능하나 우선순위 후순위.
5. TASK_BACKLOG.md에 Lane E + S18~S24 entry 추가(승인 후).
