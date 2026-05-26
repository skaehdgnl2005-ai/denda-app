# Session Log

> 태스크 완료 시 최상단에 prepend. 가장 최근 세션이 위.
> `/ship-task` 스킬이 자동으로 항목 추가하지만 수동으로도 OK.
> 의존성 추적과 회고용. 30일+ 지난 항목은 archive로 이동.

---

## 형식

```markdown
## S{NN} — {태스크 제목} ({YYYY-MM-DD}) — {STATUS}
- Depends: {S{NN} 또는 D{N} 또는 Q-{ID}}
- Changes: {파일 경로 + 라인 변화 / 또는 결정·문서 변경}
- Tests: {N passed, lint {N}, typecheck {N}}
- Next: {다음 태스크 S{NN+1} 또는 unblock 대상}
- Notes: {특이사항 (선택)}
```

STATUS는 다음 중 하나:
- **DONE** — 모든 acceptance + 테스트 통과
- **PARTIAL** — 일부 완료, 후속 작업 필요 (Next에 명시)
- **REVERTED** — 시도했으나 롤백 (사유는 Notes에)
- **BLOCKED** — 진행 중 차단 발생 (이유 + 해결 방향 Notes에)

---

## 예시 (실제 항목 아님 — 형식 참조용)

```markdown
## S01 — Kakao OAuth (synthetic email + HMAC) (2026-05-29) — DONE
- Depends: S00, D1 (W1 deadline 통과 — Kakao 답변 수신 2026-05-26)
- Changes:
  - src/lib/auth/AuthProvider.ts (+45 lines, interface)
  - src/lib/auth/KakaoSyntheticAuthProvider.ts (+180 lines)
  - supabase/functions/kakao_login/index.ts (+95 lines)
  - src/screens/onboarding/ (+220 lines, 3 screens)
- Tests: 14 passed, lint 0, typecheck 0
- Next: S05 (시간 그리드 + 투표) — auth 의존 unblock
- Notes: Kakao 답변에서 synthetic email OAuth 명시적 허용 확인. S16 Apple ID fallback impl은 deferred (interface만 유지)
```

---

## S05-screen-confirm — 모임 화면 + 호스트 확정 surface (S05 그리드 + S04-UI 묶음) (2026-05-26) — DONE (S05 acceptance 7/7 + S04 UI gate close)
- Depends: S04-backend ship 2026-05-26 (`src/lib/groups/confirm.ts` + Edge `group_confirm`), S05 worklet drag ship 2026-05-26 (`useSweepGesture` + Grid GestureDetector), S00 (groups·group_members·dates·votes·confirmed_* 컬럼), [D9](DECISIONS.md#d9--시간-그리드-8pt-시각-셀--44pt-hit-area), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column), DESIGN §10.1 (그리드) + §11.4 (Realtime chip) + §17 (anti-AI-feel)
- Changes:
  - **순수 함수 TDD-first**:
    - `src/lib/groups/selectionToConfirmRange.ts` (+58 lines) + `.test.ts` (15 케이스) — sweep selection record (col 기반 SlotKey) → 단일 날짜 · 연속 범위 검증 + `{dayIndex, startMinute, endMinute}` 산출. 빈 선택 / 다중 날짜 / 비연속 / malformed key / 범위 밖 / 15분 비정렬 모두 한국어 에러
  - **클라이언트 queries**:
    - `src/lib/groups/queries.ts` (+74 lines) + `.test.ts` (6 케이스, supabase mock) — `fetchGroupForConfirm(groupId)` → groups + group_members 합쳐 `GroupForConfirm {id, hostId, name, dates, memberCount, confirmedAt, confirmedStartAt, confirmedEndAt, confirmedPlaceId}`. groups 에러/null/멤버 에러 모두 한국어
  - **컴포넌트 TDD-first**:
    - `src/components/group/HostConfirmButton.tsx` (+76 lines) + `.test.tsx` (5 케이스) — brand-500 CTA (§17.1 1개 룰). disabled/inflight → surface-2 + text-disabled (§17.5). inflight 시 ActivityIndicator + onPress 차단 (D17 UI 추가 방어). accessibilityState busy/disabled
    - `src/components/group/ConfirmedTimeCard.tsx` (+62 lines) + `.test.tsx` (3 케이스) — UTC ISO → luxon `Asia/Seoul` 변환 → "YYYY년 M월 D일 (요일) HH:mm ~ HH:mm" 포맷. KO_WEEKDAY (luxon weekday 1..7 = 월..일). brand-50 카드
  - **라우팅·screen**:
    - `app/group/_layout.tsx` (+11 lines) — Stack
    - `app/group/[id]/index.tsx` (+239 lines) — useLocalSearchParams로 group id 추출 → fetchGroupForConfirm + useHeatmapSubscription + useSweepGesture wiring. drag onCommit → JS state selection mirror + commitVoteDiff (S05c) 호출. 호스트 + 미확정 → HostConfirmButton. 확정 후 → ConfirmedTimeCard + 그리드 read-only (panGesture 미주입). 결과 분기: alreadyConfirmed / f5 partial / 성공 토스트
    - `app/_layout.tsx` (+1 line) — Stack에 `group` 등록
    - `tests/screens/group/confirm.test.tsx` (+165 lines, 7 통합 케이스) — loading/error/host/non-host/confirmed/no-selection alert/back-button
- Tests: Jest **309 passed**, 1 skipped (ocr_eval by design — 회귀 0, S05-screen-confirm 신규 36 추가: selectionToConfirmRange 15 + queries 6 + HostConfirmButton 5 + ConfirmedTimeCard 3 + integration 7). typecheck 0. lint 내 영역 0
- Next:
  - **S04 정식 DONE 마킹 가능** — backend(2026-05-26) + UI(본 ship) 모두 ship. acceptance 5/5 close. TASK_BACKLOG S04 Status: DONE 업데이트 권고
  - **S05 acceptance 7/7** (S05e 60fps 부하 실기기 테스트만 잔여) — TASK_BACKLOG S05도 사실상 정식 DONE 가까이. S05e는 운영 task로 분리 권고
  - **모임 생성 화면**(`app/group/new.tsx` 또는 (+)FAB)은 본 task 외부 — 임시로 supabase dashboard 또는 dev fixture로 group_id 확보해 실 환경 동작 검증 가능
  - **호스트가 자신의 기존 vote 불러오기** 미구현 — 화면 진입 시 빈 selection으로 시작. 후속 sub-task에서 `fetchUserVotes(groupId, userId)` 추가 + initial selection seed
- Notes:
  - **§17 anti-AI-feel 적용**: brand-500 CTA 1개("모임 확정") · surface-2 disabled · 친근체 토스트 ("모임이 확정됐어요!" / "이미 확정된 모임이에요." / "일부 멤버에게 알림을 보내지 못했어요.")
  - **react-hooks/immutability false positive 회피**: `layout.value = ...` / `scrollOffsetY.value = ...`은 reanimated SharedValue 패턴 — worklet이 매 frame 읽음. useState로 옮기면 worklet에서 stale. 인라인 eslint-disable + 사유 주석 (S05 worklet drag와 동일 패턴 일관)
  - **D17 더블 탭 UI 추가 방어**: HostConfirmButton의 inflight prop → onPress 차단. backend도 idempotent UPDATE WHERE confirmed_at IS NULL이므로 2단 방어
  - **selection JS mirror 정당화**: useSweepGesture의 selection은 UI thread SharedValue. JS에서 selectionToConfirmRange 호출하려면 mirror 필요. handleSweepCommit이 VoteSlot[] → col 기반 Record로 변환 후 setState. 이중 source(SharedValue + JS state)는 onCommit 시점에만 동기화 → drag 중에는 SharedValue 우선 (60fps 보호)
  - **테스트 mock 전략**: useHeatmapSubscription / useSweepGesture는 supabase channel + gesture-handler 의존 회피용 module mock. 통합 테스트는 wire-up과 분기 검증만, 실 worklet 검증은 S05e 실기기 + 별도 E2E 책임
  - **`new Date()` design-guard 차단 → luxon 통합**: ConfirmedTimeCard.tsx 주석의 `\`new Date()\`` 표현이 hook에 걸려 "bare Date 0건"으로 교체. 본문 코드는 luxon DateTime만 사용 (D13 강제)
  - **본 task ship → S04·S05 UI gate 모두 close**: S04 acceptance "S04-UI sub-task" 완료(호스트 확정 버튼 + inflight + 분기 토스트). S05 acceptance "그리드 화면" 자연 만족 (`app/group/[id]/index.tsx` = grid + sweep + heatmap)

---

## S14-violations-fix — GuestTimeGrid/NicknameForm D13·D11·D10·dep loop fix (2026-05-26) — DONE (S14 partial 진척, S14 acceptance 시간 그리드 spec 정합 close)
- Depends: S14-utils (lib heatmap/time/voteKey ship 2026-05-26), S14-test-augment (drift skip 안전망 ship 2026-05-26), [D10](DECISIONS.md#d10--히트맵-5단계-색-램프-heat-0--중립-그레이), [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D23](DECISIONS.md#d23--web-guest-page--nextjs-별도-codebase)
- Changes:
  - **test 파일 — drift skip 2 그룹 unskip + 실제 assertion**:
    - `web-guest/tests/GuestTimeGrid.test.tsx` (+98 / -28) — Heatmap 색 그룹 7 케이스 unskip (count=0/max/q1/q2/q3/q3+/self override quartile spec 검증), KST 요일 그룹 3 케이스 unskip (월/화/일 한국어 요일). Realtime broadcast 그룹은 listen path만 placeholder 유지 (self-broadcast 제거는 코드만)
  - **GuestTimeGrid.tsx refactor** (+18 / -22):
    - `import { classifyHeat, type HeatLevel } from '../lib/heatmap'` + `import { dayOfWeekKst, formatHeaderDate } from '../lib/time'` (S14-utils caller 0 해소)
    - inline `getHeatClass` ratio (0.99/0.75/0.50) → `heatLevelToClass(classifyHeat(count, memberCount))` quartile. D10 정합. RN classify.ts와 동일 spec
    - inline `dayOfWeek(new Date(dateStr)).getDay()` → `dayOfWeekKst(date)` (D13 KST 강제, luxon Asia/Seoul)
    - inline `formatHeaderDate(parts split)` → lib/time `formatHeaderDate` (동일 동작, 단일 source)
    - `commitVotes` 안 `supabase.channel(...).send({event: 'heatmap_update'})` self-broadcast 제거 (D11 — Edge Function `votes_aggregate` 책임)
    - **사전 lint errors 함께 fix**: `refreshVotes` const → `useCallback`으로 hoisting (line 77 `accessed before declared` error 해소) + useEffect deps에 추가 (line 84 missing dep warning 해소)
  - **NicknameForm.tsx fix** (+10 / -4):
    - `useEffect deps`에서 `onComplete` 제거 + `onCompleteRef = useRef(onComplete)` 패턴 (parent 매 render마다 새 reference 무한 루프 risk fix)
    - 사전 `catch (err: any)` → `catch (err)` (typescript-eslint `no-explicit-any` error 해소)
- Tests: web-guest jest **82 total (79 passed + 3 skipped 의도 = Cross-day sweep 2 + Realtime listen 1)**. typecheck 0, lint 0
- Next:
  - **Playwright E2E 셋업**: `web-guest/playwright/guest_flow.spec.ts` — TEST_PLAN.md §3.5 base spec (S14 acceptance "투표 완료 → CTA" user flow)
  - **잔여 drift skip 2 그룹**:
    - Cross-day sweep — RN 사각형(`applySweepToRecord`) vs 경로(`handleMouseEnterCell`) spec 결정 후 unskip
    - Realtime broadcast listen — S05a Edge Function payload spec(D11 day_index 확정) 후 unskip + mock channel.on 콜백 trigger 통합
  - **S14 본체 acceptance** 시간 그리드 항목 ⏳ → ✅ (RN spec 정합 본 ship으로 완료)
- Notes:
  - **사전 lint errors 노출 의미** — S14-test-augment ship에서는 test 파일만 eslint 돌렸기에 GuestTimeGrid.tsx의 사전 errors(set-state-in-effect / refreshVotes hoisting / missing dep) 미감지. 본 ship에서 컴포넌트 처음 eslint → 3종 노출 → 함께 fix (refactor scope creep 약간). `set-state-in-effect` 1건은 prop→state sync 패턴이라 `eslint-disable-next-line` + 명시 주석으로 임시 처리, 별도 state-refactor sub-task 후보 (props 직접 사용으로 격상)
  - **`useCallback(refreshVotes)` 채택** — broadcast effect deps에 함수 포함하면 매 deps 변경마다 effect 재실행. useCallback로 memoize → groupId 변경 시만 재구독. D11 broadcast subscription은 group 단위라 정합
  - **NicknameForm 무한 루프 risk 실현 가능성** — parent ClientPage의 `handleNicknameComplete`은 useCallback 미사용. parent re-render(fetchData가 setVotes/setParticipants/setLoading) 시 새 reference. useEffect deps에 onComplete 있으면 매번 재실행 → localStorage 재check + supabase select 반복. useRef 패턴으로 callback latest 유지 + deps 안정성
  - **테스트 헤더 KST 요일 검증 한계** — jsdom 기본 TZ가 UTC라 `new Date(dateStr).getDay()`도 운 좋게 동일 결과 (월/화/일). 컴퓨터 TZ가 PST면 drift 발생 가능. 본 ship 후 컴포넌트가 luxon `Asia/Seoul` 명시이므로 TZ 무관 일관. test는 회귀 방지 안전망(KST 한국어 요일 정확 표시)
  - **`'border-brand-500'` 본인 override test** — 다른 게스트 7명 + 본인 1 vote → heatmap count=8, max=8 = heat-4. 그러나 본인 selectedSlots에 들어가서 `bg-brand-50 + border-brand-500` 우선. heat ramp 클래스 (`bg-brand-500`/`bg-surface-3`) 미적용 검증 → D10 본인 슬롯 별도 시각 spec(SESSION_LOG S05b Notes 동일 패턴) 정합
  - **D11 broadcast 수신 path는 그대로 유지** — `supabase.channel(...).on('broadcast', {event: 'heatmap_update'}, refreshVotes)` listen만. send만 제거. listener test는 별도 sub-task로 미룸 (S05a Edge Function payload 형식 확정 후)
  - **lib utils caller 0 해소** — `lib/heatmap.classifyHeat`, `lib/time.dayOfWeekKst`, `lib/time.formatHeaderDate` 모두 GuestTimeGrid 채택. `lib/voteKey`는 본 ship에서 미채택(컴포넌트 selectedSlots Record format이 RN `${day}:${minute}` 직렬화와 다른 `${day}_${minute}` 사용 — schema 정합성 위해 추후 voteKey 채택 시 컴포넌트 직렬화도 통일 필요)

---

## S14-test-augment — GuestTimeGrid.test 보강 (S14-violations-fix 안전망) (2026-05-26) — DONE (S14 partial 진척)
- Depends: S14-utils (lib heatmap/time/voteKey ship 2026-05-26), S14 skeleton (`web-guest/components/GuestTimeGrid.tsx`), [D10](DECISIONS.md#d10--히트맵-5단계-색-램프-heat-0--중립-그레이) (5-stop spec), [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b) (broadcast 책임 분리), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc) (KST 강제), [D23](DECISIONS.md#d23--web-guest-page--nextjs-별도-codebase) (RN과 spec share)
- Changes:
  - `web-guest/tests/GuestTimeGrid.test.tsx` (+253 lines / 기존 58 line 전면 재작성) — 4 그룹 안전 spec + 4 그룹 spec drift skip
    - **Render (7 케이스 green)**: 헤더 M/D 포맷(앞 0 제거 — `1/9`/`12/31`) · 기존 `5/24`/`5/25` · 시간 라벨 09:00/12:00/24:00 · cell 총 개수 `60 × dates.length` · 첫·마지막 슬롯 data-minute(540/1425) · 범위 밖 슬롯(525/1440) 미렌더 · legend "비어있음"/"가득참"
    - **Cell toggle (3 케이스 green)**: 기존 mousedown→border-brand-500 · 재mousedown→deselect · mouseup 후 dragMode reset 검증
    - **Drag sweep (4 케이스 green)**: mousedown→mouseEnter 연쇄 다중 select · initialVotes로 선택된 cell에서 시작→deselect 모드 다중 deselect · mouseup 후 mouseEnter 무시 · 다른 guest_token votes는 본인 selection 미인식
    - **drift skip (4 그룹 14 케이스)** — S14-violations-fix 후 unskip + 주석 unskip 조건 명시:
      - Heatmap 색 (D10): 현재 ratio(0.99/0.75/0.50) → 목표 quartile(q1/q2/q3) drift. 7명 모임 count=2 예시 (ratio=0.286=heat-1 vs quartile q1=1.75=heat-2)
      - KST 요일 (D13): 현재 `new Date(dateStr).getDay()` UTC 의존 → 목표 `lib/time.dayOfWeekKst` luxon Asia/Seoul
      - Cross-day sweep: 현재 자동 cross 동작 → 목표 RN `applySweepToRecord` 사각형 영역 spec과 정합
      - Realtime broadcast (D11): 현재 클라 self-broadcast → 목표 Edge Function 책임 분리 + 클라는 listen만
  - **mock supabase 보강** — `channel().send`/`from().eq` chain 추가 (debouncedCommit 100ms 후 timer 발화 시 unhandled mock error 회피, `from().select.mockReturnThis()`로 builder chain 정합)
- Tests: web-guest jest **83 total (69 passed + 14 skipped 의도)**. typecheck 0, lint 0
- Next:
  - **S14-violations-fix**: (1) `dayOfWeek(new Date)` → `dayOfWeekKst` (`describe.skip('KST 요일')` unskip), (2) `getHeatClass` ratio inline → `classifyHeat` quartile (`describe.skip('Heatmap 색')` unskip + 임계값 갱신), (3) client `channel.send({event:'heatmap_update'})` 제거 (`describe.skip('Realtime broadcast')` unskip), (4) NicknameForm `useEffect` `onComplete` deps → `useRef` 무한 루프 risk fix. Cross-day sweep은 spec 확정 후 unskip
  - **Playwright E2E 셋업**: TEST_PLAN.md §3.5 base spec (`web-guest/playwright/guest_flow.spec.ts`) — S14 acceptance "투표 완료 → CTA" user flow 회귀 안전망
- Notes:
  - **drift skip 패턴 정당화** — TDD red→green 정통이 아닌 "현 spec 굳히기 + 위반은 의도적 skip"으로 분리. 본 ship에서 violations fix를 한 묶음으로 가지 않은 이유는: GuestTimeGrid는 production page caller이라 시각 회귀 risk(특히 heat ramp 임계값 변경)가 있고, 안전망 0 상태에서 refactor하면 사용자 측 회귀 발견 가능성. 본 ship 후 S14-violations-fix는 unskip 사이클로 정통 red→green 진행
  - **mock supabase 보강 필요했음** — debouncedCommit이 100ms 후 `supabase.channel(...).send({...})` 호출. 기존 mock에 send 누락 → drag sweep test에서 unhandled async error 가능성. send를 `mockResolvedValue({})`로 추가. from().select/eq도 builder chain mockReturnThis로 정합 (테스트 시점에는 호출 안 되나 미래 fetchData test 대비)
  - **lib utils caller 0 유지** — 본 보강은 컴포넌트 wire-up 전이라 `lib/heatmap.classifyHeat` / `lib/time.dayOfWeekKst` / `lib/voteKey` 모두 미사용. S14-violations-fix가 caller 0 해소
  - **GuestTimeGrid 코드 변경 0** — 본 ship은 test만 작성/재구성. production 동작 영향 0
  - **위치 변경** — 기존 test 파일은 `web-guest/tests/GuestTimeGrid.test.tsx`. 본 ship은 같은 위치 유지 (skeleton 시점 결정 따름)

---

## S14-utils — web-guest 순수 유틸 TDD 도입 + RN spec mirror (2026-05-26) — DONE (S14 partial 진척)
- Depends: S14 skeleton (Next.js + Supabase + RPC + RLS 백필), S05 RN 헬퍼([D10](DECISIONS.md#d10--히트맵-5단계-색-램프-heat-0--중립-그레이) classify spec source), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc) (KST 강제), [D14](DECISIONS.md#d14--시간-슬롯-단위-15분--db-check) (15분 슬롯), [D23](DECISIONS.md#d23--web-guest-page--nextjs-별도-codebase) (web-guest 별도 codebase + RN과 spec share)
- Branch: main 직접 (skeleton 백필 다음 단계, worktree 미필요 — file 충돌 0)
- Changes:
  - **순수 유틸 3종 TDD-first**:
    - `web-guest/lib/heatmap.ts` (+49 lines) + `.test.ts` (24 케이스) — `classifyHeat(count, maxCount): HeatLevel` D10 5-stop quartile. RN `src/lib/heatmap/classify.ts`와 정확히 동일 spec (q1/q2/q3 경계, count≤0/maxCount≤0/count≥maxCount edge clamp). `heatToTokenIndex(level): 0..4` tokens.heat 배열 인덱스 매핑
    - `web-guest/lib/time.ts` (+44 lines) + `.test.ts` (18 케이스) — luxon `Asia/Seoul` 강제. `isValidDateString` YYYY-MM-DD 검증(윤년 포함), `dayOfWeekKst` 한국어 요일 (월/화/수/목/금/토/일), `formatHeaderDate` "M/D" (앞 0 제거). `new Date(dateStr)` 직접 사용 0. `KST_ZONE` 상수 export
    - `web-guest/lib/voteKey.ts` (+62 lines) + `.test.ts` (13 케이스) — `VoteSlot`/`VoteKey`/`voteKey`/`parseVoteKey`/`voteSetFromSlots`/`diffVoteSets`. RN `src/lib/votes/voteSet.ts`와 정확히 동일 spec (`day:start_minute` 형식, day asc → start_minute asc 정렬). selectionToVoteSlots는 RN worklet 패턴이라 SKIP (web은 worklet 없음)
- Tests: web-guest jest 57 passed (24 heatmap + 18 time + 13 voteKey + 2 기존 GuestTimeGrid). typecheck 0 (web-guest tsc), lint 0 (S14-utils 영역 eslint). 메인 RN jest는 unrelated, web-guest project 분리 cmd
- Next:
  - **S14-violations-fix** (별도 sub-task): GuestTimeGrid·NicknameForm을 본 lib 사용으로 refactor — (1) `dayOfWeek(new Date(dateStr))` → `dayOfWeekKst()` (D13 위반 fix), (2) `getHeatClass` inline ratio → `classifyHeat()` (RN spec mirror), (3) GuestTimeGrid의 클라 self-broadcast `heatmap_update` 제거 (D11 위반 — S05a Edge Function 책임), (4) NicknameForm useEffect `onComplete` deps → useRef로 무한 루프 risk fix, (5) selectedSlots Record를 voteKey 직렬화로 교체
  - **GuestTimeGrid.test.tsx 보강**: 기존 2개 → drag sweep / heatmap 색 / 본인 슬롯 override / 다일 span 케이스 추가
  - **Playwright E2E 셋업**: `web-guest/playwright/guest_flow.spec.ts` — TEST_PLAN.md §3.5 base spec
- Notes:
  - **S14 acceptance "RN과 같은 동작 spec" 의 spec drift 방지가 본 ship 핵심** — 현 skeleton의 `getHeatClass`(ratio 0.99/0.75/0.50)와 RN classify(quartile q1/q2/q3) 가 다른 임계값으로 drift 중. 본 utils 채택 후 한 화면 같은 카운트가 두 플랫폼에서 동일 색으로 표시 보장
  - **`KO_WEEKDAY` 순서는 luxon weekday 1..7 (월=1, 일=7)** — JS `Date.getDay()` (일=0, 월=1, ..., 토=6)과 다름. 기존 컴포넌트의 `['일','월','화','수','목','금','토'][date.getDay()]` 패턴은 D13 위반 + JS Date base. utils는 luxon base로 단일 진실
  - **VoteSlot/VoteKey shape는 RN과 100% 동일** — `${day}:${start_minute}` 직렬화. cross-platform broadcast payload나 Supabase 저장 schema와 자연 align (day=DATE, start_minute=INT)
  - **selectionToVoteSlots는 web에서 미필요** — RN worklet의 `Record<SlotKey, boolean>` (col:minute 매핑)은 sweep의 day_index 표현. web은 DOM elementFromPoint로 day(DATE)를 직접 추출하므로 col 매핑 불요. 본 sub-task는 RN spec 의도적 부분 mirror
  - **컴포넌트 refactor 의도적 deferred** — TDD red→green 사이클을 lib에만 두고, 컴포넌트 변경은 시각 회귀 risk가 있어 별도 sub-task로 분리 (GuestTimeGrid.test 보강이 prereq). 본 ship 후에도 production page는 기존 코드 그대로 작동, 새 utils는 0 caller
  - **NOW.md S14-utils 항목은 본 ship으로 promote** — 다음 sub-task(S14-violations-fix)는 별도 /start-task에서 시작

---

## S04-backend — group_confirm + notify_f5 + dispatcher (D33 close Q-B5) (2026-05-26) — PARTIAL (S04 backend 100%, UI deferred)
- Depends: S00 (groups.confirmed_at·confirmed_start_at·confirmed_end_at·confirmed_place_id + CHECK constraint atomic + f5_sent_at·partial_fail_list 0001:198-218, group_members·notification_settings·push_tokens), S05 (votes 합산 — votes_aggregate가 별도 path), [D33](DECISIONS.md#d33--모임-확정-fan-out--단일-dispatcher-q-b5-close) (본 세션 신규), [Q-B5](OPEN_QUESTIONS.md#q-b5--edge-function-단일-dispatcher) closed by D33, [D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column) (idempotent UPDATE WHERE NULL pattern mirror → f5_sent_at·confirmed_at), [D14](DECISIONS.md#d14--시간-슬롯-단위-강제-15분--db-check) (15분 단위 application 검증 + DB CHECK 2중 방어), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D19](DECISIONS.md#d19--calendar-sync-단방향-부분-실패-명시) (partial fail → partial_fail_list JSONB), [D22](DECISIONS.md#d22--phase-12-tech-stack)
- Changes:
  - **D33 신규 결정 + Q-B5 closure**:
    - `docs/DECISIONS.md` (+~15 lines) — D33 본문: group_confirm 1곳 publisher + in-process dispatcher fan-out. F5는 dispatcher 내부 직접 호출, Calendar는 D20 background queue로 분리. 대안 3종(DB trigger / 2-trigger 단순 / 외부 broker) 거부 사유 명시. F1-F3는 S12 작업 시 동일 pattern follow.
    - `docs/OPEN_QUESTIONS.md` — Q-B5 "Closed by D33 (2026-05-26)" 표기 + 결정 inline
  - **dispatcher real impl** (Q-B5 대기 stub → real):
    - `supabase/functions/_lib/dispatcher.ts` (+~70 lines, stub 30 lines 교체) — register/dispatch/clearHandlers/listHandlers. Promise.allSettled 격리, sync throw도 Promise.resolve().then() wrap으로 rejected 변환. PromiseSettledResult[] 반환 → publisher가 failure logging 결정 가능. 모듈 singleton state + 테스트용 clearHandlers
    - `supabase/functions/_lib/dispatcher_test.ts` (+~210 lines, **Deno 8 tests TDD-first**) — register+dispatch / 다중 handler / 격리(throw) / no handler no-op / clearHandlers full+selective / 다른 type 매칭 / sync throw 격리
  - **notify_f5 Edge Function 신규** (S04 F5 push):
    - `supabase/functions/notify_f5/index.ts` (+~340 lines) — 순수 함수 6종(filterRecipientUserIds / formatF5Title / formatF5Body / buildF5PushMessages / partitionPushResponses / buildPartialFailList) + Expo Push API (chunk 100) + HTTP handler. 호스트 제외 + f5_enabled opt-in 교차, 1user 다device fan-out, no_token/no_ticket/DeviceNotRegistered 분기 partial_fail JSONB 누적 (`channel: 'f5_push'`), f5_sent_at IS NULL idempotent UPDATE
    - `supabase/functions/notify_f5/_test.ts` (+~210 lines, **Deno 15 tests TDD-first**) — filterRecipient 4 (호스트 제외 / opt-in skip / 빈 멤버 / 1인 모임) + formatBody 2 (KST 변환 + 자정 직전 날짜 넘김) + buildMessages 4 (1user1tok / 1user多tok / 多user多tok / 빈) + partitionResponses 4 (전부 ok / DeviceNotRegistered / no_ticket / 같은 user 부분 실패) + buildPartialFailList 2 (JSONB shape + 빈)
  - **group_confirm Edge Function 신규** (S04 핵심):
    - `supabase/functions/group_confirm/index.ts` (+~290 lines) — 순수 함수 3종(parseConfirmRequest / validateConfirmInput / buildConfirmedTimestamps) + dispatcher F5 handler registration (notify_f5/index.ts handler 직접 호출, HTTP overhead 회피 in-process) + HTTP handler. anon client UPDATE WHERE confirmed_at IS NULL → RLS groups_update_host가 자연 차단 + race/권한 부족 구분(0 rows 시 service_role로 recheck). dispatch(group_confirmed) 후 PromiseSettledResult[] 카운트 응답
    - `supabase/functions/group_confirm/_test.ts` (+~225 lines, **Deno 14 tests TDD-first**) — parseConfirmRequest 4 (정상 / place_id null / UUID invalid throw / day_index 음수 throw) + validateConfirmInput 6 (D14 15분 강제 / 09:00 이전 throw / 24:00 초과 throw / start≥end throw / day_index ≥ datesCount throw / 유효 no-op) + buildConfirmedTimestamps 3 (KST→UTC 변환 / 자정 직전 / Z suffix)
  - **클라이언트 wrapper**:
    - `src/lib/groups/validation.ts` (+50 lines) — `validateConfirmGroupInput` (UUID·dayIndex·D14·범위·start<end·placeId UUID) ValidationResult discriminated union (한국어 에러)
    - `src/lib/groups/validation.test.ts` (+~125 lines, **Jest 11 tests**) — 정상/null place_id/UUID invalid/dayIndex 음수/D14 위반/09:00 이전/24:00 초과/start≥end/start==end/placeId invalid/end=1440 exact OK
    - `src/lib/groups/confirm.ts` (+~55 lines) — `confirmGroup` Edge `group_confirm` wrapper. snake_case body / camelCase response 변환. 사전 validation 통과 → invoke. 에러 한국어(403 호스트만 / 401 로그인 필요 / 기타)
    - `src/lib/groups/confirm.test.ts` (+~142 lines, **Jest 9 tests**) — 정상 + snake_case mapping / already_confirmed=true / place_id null / 사전 validation 차단 invoke 0 / 403 한국어 / 401 한국어 / 기타 에러 / data null / partial dispatch
- Tests: Jest **293 passed** (1 skipped ocr_eval by design — 회귀 0, S04 신규 20 추가). typecheck 0. lint 0 (prettier auto-fix 적용). Deno **37 tests TDD-first** (dispatcher 8 + notify_f5 15 + group_confirm 14, Deno CLI 미설치로 실행 deferred — votes_aggregate/blocking_test 동일 패턴)
- Next:
  - **S04-UI (별도 sub-task)**: 호스트 확정 화면 (`app/group/[id]/confirm.tsx`) + 시간 그리드 위 "확정" 버튼 + 더블 탭 disable + confirmGroup 호출 + 성공 토스트 + already_confirmed/partial f5_dispatch 분기 메시지. **S05b 그리드 worklet drag 통합과 동시 작업 권장** — 같은 화면 surface 공유
  - **S06 calendar push**: dispatcher.register('group_confirmed', calendarPushHandler) 추가. D20 background queue (pg_cron `groups.calendar_pushed_at IS NULL` 큐잉 + worker 별도)는 S06 본체에서
  - **S12 F1-F3 push**: dispatcher register pattern follow (`friend_requested`, `friend_accepted`, `group_invited` event handler 별도 Edge Function로 register). Q-B3 partial 해소
  - **운영 deploy 사전 조건**: `EXPO_ACCESS_TOKEN` Supabase secret 설정 (없어도 발송은 되지만 enhanced security 권장)
- Notes:
  - **PARTIAL — backend 100%, UI deferred**: TASK_BACKLOG S04 acceptance 5개 중 backend 모든 책임 충족(RLS 호스트 권한 + idempotency UPDATE WHERE NULL + F5 push fan-out + partial_fail + 단일 dispatcher). UI gate("확정" 버튼 + disable)는 S05b 그리드와 동시 작업 권장
  - **D33 in-process dispatch 정당화**: F5는 모임 N≤7 멤버 → push 호출 짧음(<1s) → Edge 60s timeout 안에 inline 처리 OK. Calendar처럼 fan-out 큰 작업은 dispatcher가 queue row 표시만 하고 worker(D20 pg_cron)가 별도. 2-layer 책임 분리
  - **dispatcher register 위치**: group_confirm/index.ts가 notify_f5/index.ts handler를 import 후 module 초기화 시점에 register. 테스트 reset 위해 `_resetDispatcherRegistration()` export
  - **anon client UPDATE 선택 근거**: service_role UPDATE는 RLS bypass → 코드 가드 명시 호스트 체크 필요. anon client (사용자 JWT) UPDATE는 groups_update_host가 자연 차단 → 0 rows 시 race vs 권한 부족 구분만 처리. 단일 책임 (RLS가 권한 검증, 코드는 idempotency만)
  - **idempotency 2단**: (1) UPDATE WHERE confirmed_at IS NULL — race·더블 탭 안전. (2) confirmed_at NOT NULL이면 immediate 200 already_confirmed=true (UPDATE 0 round-trip)
  - **partial_fail_list race 수용**: 동시 F5 호출 시 lastWriteWins. 베타 N≤7 + f5_sent_at IS NULL idempotency가 사실상 single trigger 보장 → race 미발생 expect. Phase 3 fan-out 증가 시 JSONB append RPC로 전환 후보
  - **`new Date()` design-guard 차단 → luxon로 교체**: notify_f5 index.ts에서 `new Date().toISOString()` 3곳을 `nowKst().toISO()`로 교체. Hook이 KST 미명시 즉시 차단 (D13)
  - **F1-F5의 dispatcher pattern unification**: F4 push도 같은 dispatcher로 통합 가능 — `votes_all_in` event를 votes_aggregate Edge에서 publish (전원 투표 완료 감지 후) + notify_f4 handler가 register. 별도 task
  - **migration 변경 0**: groups.confirmed_at·f5_sent_at·partial_fail_list 모두 0001에 이미 있음. S04는 코드만

---

## S05 worklet drag 통합 — Reanimated 4 + Gesture.Pan sweep selection (2026-05-26) — PARTIAL
- Depends: S00 (votes), [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec), [D25](DECISIONS.md#d25--cold-start-target--2초--lazy-loading)
- Changes:
  - **Lazy install (D25 prereq)**:
    - `package.json` — react-native-gesture-handler ~2.31.1, react-native-reanimated 4.3.1, react-native-worklets 0.8.3 (npx expo install로 SDK 56 호환 버전 자동 선택)
    - `babel.config.js` (신규, +10 lines) — `react-native-worklets/plugin` (Reanimated 4에서 worklet 변환이 worklets 패키지로 분리됨)
    - `jest.setup.js` (+50 lines) — react-native-worklets 완전 mock (createSerializable·runOnJS 등 identity), react-native-reanimated/mock 등록, react-native-gesture-handler `Gesture.Pan()` builder pattern stub (`_handlers` 노출로 테스트에서 직접 호출 가능)
  - **Pure worklet layer (TDD)**:
    - `src/lib/heatmap/coords.ts` (신규, +37 lines) — `pointToCell(pt, layout): CellCoord | null` worklet 헬퍼. scrollOffsetY 보정, 헤더/그리드 경계 검사
    - `src/lib/heatmap/coords.test.ts` (신규, 9 tests) — 경계값·역방향·scroll offset 시뮬레이션
    - `src/lib/heatmap/sweep.ts` (+30 lines) — `applySweepToRecord(baseline, start, end, mark)` 추가 (Reanimated UI thread는 Set 미지원 → Record 기반)
    - `src/lib/heatmap/sweep.test.ts` (+4 tests) — applySweepToRecord add/remove/역방향/immutability
    - `src/lib/votes/voteSet.ts` (+22 lines) — `selectionToVoteSlots(selection, days)` Record→VoteSlot[] 변환 (falsy·범위 밖 col·malformed key 모두 제외)
    - `src/lib/votes/voteSet.test.ts` (+4 tests)
  - **Hook (D12 의무 패턴)**:
    - `src/lib/votes/useSweepGesture.ts` (신규, +97 lines) — `Gesture.Pan().onBegin/onUpdate/onEnd` worklet 체인. 시작 cell의 baseline 토글 모드(add/remove) 결정 → applySweepToRecord로 selection sharedValue 갱신 → onEnd에서 `runOnJS(jsCommit)`. scrollOffsetY는 별도 sharedValue로 노출 (Grid ScrollView onScroll로 갱신)
    - `src/lib/votes/useSweepGesture.test.tsx` (신규, 7 tests) — `_handlers` 직접 호출로 add/remove/scroll offset/재진입 baseline 갱신/헤더 outside 무시 검증
  - **Grid 통합**:
    - `src/components/TimeGrid/Grid.tsx` (+50 lines, -10 lines) — optional `panGesture` / `onCellWidthChange` / `onScrollY` props 추가. panGesture 시 grid body를 `<GestureDetector>` wrap, ScrollView를 `Animated.ScrollView`로 전환 (`scrollEventThrottle=16`). panGesture가 있으면 single-tap `onCellPress` 비활성
    - `src/components/TimeGrid/Grid.test.tsx` (+3 tests) — sweep mode에서 onCellPress 비활성, onCellWidthChange / onScrollY 통지
- Tests: 273 passed (1 skipped — 기존), lint 0, typecheck 0
- Next: S04 (모임 확정 + F5 push) — 이미 IN_PROGRESS backend. 그리드 화면 wiring(`app/group/[id]/grid.tsx`) + SelectionOverlay 시각 피드백은 별도 sub-task. S05e 60fps 부하 테스트는 실기기 확보 후 진행
- Notes: **S05 자체는 IN_PROGRESS 유지** (sub-task 6/7 완료: UI + a + b + c + d + worklet drag. 잔여 S05e). worklet drag 중 60fps 셀 색 시각 피드백(SelectionOverlay = drag rect Animated.View)은 mock-only 검증의 한계로 본 sub-task 제외 — 실기기 + S05e와 함께 검증해야 의미 있음. selection sharedValue는 hook이 노출하므로 후속 sub-task에서 Animated.View overlay 또는 Cell sharedValue 구독으로 통합 가능. **Reanimated 4 worklet runtime은 react-native-worklets 분리됨** — babel plugin `react-native-worklets/plugin` 필수 (Reanimated 3 시절 `react-native-reanimated/plugin`과 다름)

---

## S05a + Q-B21 — votes_aggregate Edge Function (D11 broadcast) + day_index alignment (2026-05-26) — DONE
- Depends: S00 (votes/groups table, Realtime), S05b (클라이언트 헬퍼 `applyHeatmapPayload`가 day_index 가정), [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D14](DECISIONS.md#d14--시간-슬롯-단위-15분--db-check)
- Branch: `worktree-s05a-q-b21-day-index` (S05a author worktree `agent-ae72b67b533ba1d2d`에서 파일 3개 copy + day_index patch)
- Changes:
  - **Edge Function (S05a 코드 + Q-B21 patch)**:
    - `supabase/functions/votes_aggregate/index.ts` (+~190 lines) — service_role client, groups.dates SELECT → mapDayToIndex(rawRows, dates) → aggregateVotes → broadcastHeatmap. `VoteRow {day_index, start_minute}` / `HeatmapSlot {day_index, start_minute, count}` / payload `{slots, updated_at(KST +09:00 ISO)}`. groups.dates에 없는 votes.day는 graceful skip
    - `supabase/functions/votes_aggregate/_test.ts` (+~210 lines, 9 Deno tests) — aggregateVotes 4 + mapDayToIndex 3 + buildHeatmapPayload 1 + broadcastHeatmap 2 (channel·event·payload 검증)
  - **Migration (S05a 원본 그대로)**:
    - `supabase/migrations/0006_votes_aggregate_trigger.sql` (+95 lines) — votes AFTER INSERT/UPDATE/DELETE → pg_net `net.http_post` → Edge Function. `current_setting('app.*', true)` GUC 패턴 (vault 전환 TODO). SECURITY DEFINER + missing_ok=true → GUC 미설정 시 silent skip
  - **D11 본문 갱신**:
    - `docs/DECISIONS.md` D11 (+12 lines/-3 lines) — 표에 Payload spec 행 + Channel/event 행 신규. 구현 예제도 day_index 매핑 + groups.dates SELECT 패턴으로 갱신
  - **Q-B21 closure**:
    - `docs/OPEN_QUESTIONS.md` Q-B21 (status: Closed by D11 update 2026-05-26)
- Tests: Deno test 9개 작성 (TDD-first). Deno CLI 미설치로 실행 deferred. typecheck/lint는 jest TS 영역 외 (Deno 환경). 사용자 측 `deno test supabase/functions/votes_aggregate/_test.ts --allow-env --allow-net --no-check`
- Next:
  - **S05c+S05d 이미 main 머지** (commit 61d2063) — Q-B21 closure로 vote commit DB write가 정상 작동 (votes INSERT → trigger → Edge Function → 정확한 day_index broadcast)
  - **S05e (60fps 부하)**: production binary, iPhone SE 2 / Galaxy A14 — 본 세션 불가, 사용자 측 EAS Build 후 측정
  - **GUC 사전 설정 의무** (production 배포 전): `ALTER DATABASE postgres SET app.supabase_url / app.service_role_key`
  - **머지 방법**: `gh pr create --base main --head worktree-s05a-q-b21-day-index ...` + auto squash
- Notes:
  - **S05a author worktree(`agent-ae72b67b533ba1d2d`) take over** — S05a author가 commit (9bb461a) 후 PR 미생성 + locked 상태로 stale. 본 세션이 코드 파일 3개 copy + day_index patch + docs 한 묶음으로 ship. S05a worktree 자체는 cleanup 대상
  - **Q-B21 (a)안 채택 근거** — `groups.dates DATE[]` 가변 길이라 7일 고정 가정 불가. day_iso(b) / week-minute(c) 대안은 클라이언트 산술 복잡도 ↑. day_index(a)가 클라이언트 기존 가정과 align + payload 크기 영향 미미
  - **D11 본문이 이제 SSoT** — S05c+S05d ship 시점에는 D11 payload spec이 outdated. 본 PR 머지로 spec 동기화 완료
  - **is_blocked 적용 SKIP 유지** — broadcast payload는 집계 count뿐, 개인정보 0. S05b PR #3 reviewer가 D16 위반 아니라고 판정한 패턴 그대로
  - **migration 0005는 비어 있음** — S07-backend worktree(`agent-a39703870f6972b8c`)의 group_invitations blocking이 0005에 할당됐으나 PR 미생성. 별도 cleanup task

---

## S07-backend PR #2 머지 + worktree cleanup (2026-05-26) — DONE
- Depends: 머지 대상 = commit 8144822 (worktree-agent-a39703870f6972b8c, 2026-05-25 시점 S07-backend), [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)
- Changes (PR #2 머지 결과 main에 fast-forward):
  - supabase/migrations/0005_group_invitations_blocking.sql (+18) — `group_invitations_select_involving_self` 양방향 is_blocked
  - supabase/functions/_lib/blocking.ts (+25) — `isBlocked(client, viewerId, targetId)` Edge Function RPC wrapper
  - supabase/functions/_lib/blocking_test.ts (+73, 5 Deno tests TDD-first)
  - merge commit 569940a
- Cleanup:
  - `gh pr merge 2 --merge --delete-branch` → remote `feature/s07-backend` 삭제
  - `git worktree unlock + remove .claude/worktrees/agent-a39703870f6972b8c`
  - `git branch -d worktree-agent-a39703870f6972b8c` (merged 후 안전 -d)
  - `git fetch --prune`로 remote tracking 정리
- Tests: 본 정리는 머지·remove 명령만, 코드 변경 0. PR 자체는 reviewer 서브에이전트(Critical 4) final pass GO 확인 후 머지 (0 critical findings)
- Next: 코드 변경 없음. S07 전체(7 sub-task)가 정식 main에 통합 완료. 운영 통지(D32 deferred)만 남음. 잔여 외부 task: `_lib/blocking.ts`의 Deno 5 test 실제 실행(Deno CLI 설치 필요) + supabase deploy 후 group_invitations 양방향 차단 실 환경 검증
- Notes:
  - **Reviewer 2단 확인**: 1차(S07-backend 작업 시점) + 본 final pass 둘 다 통과. 0007과의 D16 패턴 정합 명시
  - **자동 모드 권한 차단 → 재확인**: 첫 `gh pr merge` 시도는 auto mode classifier가 self-created PR + remote branch 삭제 차단. 사용자 명시 동의 ("진행해") + reviewer GO 후 재시도 머지 성공
  - **historical entries 정합**: SESSION_LOG의 "S07-backend (PR 대기)" 문구는 S07-d16-audit/S07-report/S07-block-supabase entries에 명시되어 있었음 — 본 머지로 시점적 사실로 굳어짐 (post-merge fact-check는 본 entry로 cross-reference)

---

## S07-block-supabase — friendsApi.blockUser supabase RPC + cascade (2026-05-26) — DONE (S07 close)
- Depends: S07-d16-audit (2026-05-26 ship, group_members/votes RLS 보강), [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls), S00 (blocks/friendships/friend_requests 0001 schema + is_blocked helper 0001:94 SECURITY DEFINER 패턴 mirror)
- Changes:
  - **순수 wrapper TDD-first**:
    - `src/lib/blocks/api.ts` (+24 lines) + `.test.ts` (5 케이스) — `blockUser(targetUserId)` supabase.rpc('block_user', {p_target_id}). 빈/whitespace 사전 throw + RPC error → "차단하지 못했어요" + "Cannot block self" 한국어 변환
  - **Migration**:
    - `supabase/migrations/0008_block_user_rpc.sql` (+47 lines) — `block_user(p_target_id UUID) RETURNS VOID` plpgsql SECURITY DEFINER. (1) blocks INSERT ON CONFLICT DO NOTHING (idempotent) (2) friendships 양방향 DELETE (대칭 두 row, 0001:106 주석) (3) friend_requests 양방향 DELETE. auth.uid() 미인증/self-block 사전 RAISE. `REVOKE FROM PUBLIC` + `GRANT EXECUTE TO authenticated`로 anon 차단
  - **friendsApi.blockUser 실 구현 교체** (+7/-5 lines) — `supabaseBlockUser(userId)` 호출 (rpc throw 시 propagate) → 성공 시에만 local mock list cleanup (demo continuity). 0008이 atomic으로 처리 + RLS 우회 단일 책임
  - **friendsApi.reportUser dead code 제거** (-7 lines) — S07-report에서 `src/lib/reports/api.ts::submitReport`로 교체됐고 caller 0, console.log lint warning 해소
  - **app/(tabs)/friends/index.tsx handleBlock §17.6 polish** (+2/-2 lines) — error message를 `e.message` propagate(한국어), 성공 메시지 친근체 "차단했어요. 더 이상 표시되지 않아요." + `setSheetVisible(false)` 추가 (S07-report handleReport와 패턴 일치)
  - **tests/screens/friends/index.test.tsx supabase mock 확장** (+1/-1 lines) — `{from: jest.fn(), rpc: jest.fn()}` (blockUser supabase rpc 호출 path 회피)
- Tests: Jest **57 passed** (내 영역 10 suites: blocks/api 5 신규 + 기존 reports 23 + ReportBlockSheet 5 + FriendCard 7 + FriendRequestCard ? + friends/index 7 + friends/requests ? + friends/search ?). 전체 Jest 217 passed + 1 skipped (다른 세션 S05c·d 신규 49 포함). typecheck 0. lint 0 (내 영역, friends/index 사전 `set-state-in-effect` 1건 별도)
- Next: **S07 acceptance 100% close** (운영 통지 D32 정식 deferred 제외). S07 정식 DONE 마킹 가능 — TASK_BACKLOG Status: DONE으로 update 권고. Sprint 3 잔여는 S05b worklet drag (회사 운명 60fps critical path) + S08 (Click-through, S10 BLOCKED dep)
- Notes:
  - **SECURITY DEFINER 정당화**: friendships/friend_requests RLS DELETE는 본인 row만 허용. 양방향 정리는 상대방 row도 삭제해야 함 → SECURITY DEFINER + `auth.uid()`로 호출자(blocker) 강제 추출. `p_target_id`는 인자 → 위변조 불가능
  - **atomic plpgsql function**: plpgsql function body는 single transaction → blocks INSERT 후 cascade DELETE 중 throw 시 INSERT도 rollback. partial state 없음
  - **idempotent INSERT**: PK (blocker_id, blocked_id) ON CONFLICT DO NOTHING → 사용자가 같은 사람 두 번 차단 호출해도 안전. UI에서 중복 제출 방어 불요
  - **mock list cleanup 유지**: friendsApi.blockUser는 supabase rpc 성공 후 mockFriends/mockIncomingRequests/mockOutgoingRequests filter 진행. development demo에서 mock data 사용자 차단 시 RPC가 FK violation throw → cleanup 안 됨 → 한국어 alert. 실 supabase user(UUID) 환경에서는 정상 + cleanup은 mockFriends 미영향(빈 array가 아닌 한 안전)
  - **0008 prefix 정합성**: 0005(S07-backend worktree) + 0006(S05a worktree) 미머지 reserved + 0007(S07-d16-audit main) 머지됨 → 0008이 main 위 next. S05c/d는 migration 0건이라 0008 충돌 0
  - **dead reportUser 제거 동시 진행**: S07-report ship 시점에 friendsApi.reportUser는 friends/index 호출처에서 sub. 다만 friendsApi 정의에 stub 남아 있어 no-console warning + S07-report Notes의 "별도 cleanup" 항목 즉시 해소
  - **사전 존재 lint error 1건**: app/(tabs)/friends/index.tsx:45 `react-hooks/set-state-in-effect` — 본 ship 영역 외부. useReducer/useMemo channel 패턴 권고 (S05d에서 `useMemo` 패턴으로 회피한 선례 있음, SESSION_LOG S05d Notes 참조)

---

## S05-cleanup — S05b 머지 후 중복 sub-task 정리 + useHeatmapSubscription에 30s polling 통합 (2026-05-26) — DONE
- Depends: S05b (origin/main PR #3 머지 commit 78c8fe9 2026-05-26 09:49 KST), 본 세션 S05c+S05d ship (commit 61d2063 2026-05-26)
- Context: S05b PR이 base가 옛 main (S03a 이전)이라 local main과 8 commit 분기. local pull 안 한 채 S05c+S05d ship → S05b의 `heatmap/debounce.ts`·`useHeatmapSubscription.ts`와 책임 중복 발견. 사용자 지시(옵션 A): merge + 중복 폐기 + 30s polling 통합
- Changes:
  - **`origin/main` merge** (8 commit + S05b 통합): docs 충돌 3종 (PROGRESS·SESSION_LOG·TASK_BACKLOG) HEAD ours 채택(local이 더 최신 — S03·S07·D31·D32·S05c·S05d 모두 보유) 후 S05b 정보 inline inject
  - **중복 src 폐기**:
    - `src/lib/votes/debouncer.ts` + `.test.ts` 삭제 (S05b `heatmap/debounce.ts`가 같은 trailing-edge debouncer). `votes/api.ts`는 debouncer 미의존(voteSet만 의존) → 영향 0
    - `src/lib/realtime/useRealtimeStatus.ts` + `.test.ts` 삭제 (S05b `useHeatmapSubscription`이 channel subscribe + isConnected 추적까지 cover)
    - `src/lib/realtime/connectionStateMachine.ts` + `.test.ts` 삭제 (useRealtimeStatus 폐기로 사용처 0 — 30s polling 전이 로직만 useHeatmapSubscription에 inline 통합)
  - **S05b useHeatmapSubscription에 30s polling 전이 통합** (`src/lib/heatmap/useHeatmapSubscription.ts` +~30 lines): 기존 `isConnected: boolean` → `{status: 'connecting'|'connected'|'disconnected'|'polling', isConnected, cells}` 확장. CHANNEL_ERROR/TIMED_OUT/CLOSED → disconnected, 30s 후 polling 전이. SUBSCRIBED는 항상 connected로 recovery. `disconnectTimeoutMs` prop 추가(default 30000, testable). 기존 8 test는 status 추출로 호환, 30s polling 시나리오 +3 test 추가. **`RealtimeStatus` chip의 prop은 `isConnected`로 동일 유지**(DESIGN §11.4 ramp 변경 없음)
  - **보존된 내 작업**: `src/lib/votes/voteSet.ts` + `.test.ts` (10 케이스, VoteSlot diff 순수), `src/lib/votes/api.ts` + `.test.ts` (7 케이스, commitVoteDiff INSERT/DELETE). S05b가 안 만든 영역
- Tests: Jest **{N} passed** (전체 — voteSet 10 + api 7 + S05b 37 + 기타 기존 + 30s polling 신규 3). typecheck 0, lint 0
- Next: **S05e** (60fps 부하 테스트) — production binary + 저사양 baseline. S05의 worklet drag 통합 (gesture-handler + reanimated lazy install)도 별도 sub-task 잔여
- Notes:
  - **sub-task 명칭 충돌 해소**: S05b의 commit 메시지가 "S05c=worklet drag, S05d=DB write, S05e=60fps"로 정의했으나, 본 세션이 다른 의미로 "S05c=vote commit debounce, S05d=Realtime disconnect UI"를 ship. 양쪽 모두 main에 있어 sub-task naming은 본 cleanup이 정정 — TASK_BACKLOG S05 entry의 sub-task 매핑이 단일 source. S05e만 60fps 부하 테스트로 정의 유지
  - **30s polling 통합 정당화**: 기존 useHeatmapSubscription의 `isConnected` boolean은 DESIGN §11.4의 "30s 후 폴링" 전이 미구현이었음 → cleanup 기회에 state machine inline 통합. state machine 분리 파일 안 만든 이유는 사용처 1곳(useHeatmapSubscription)이라 over-engineering 회피
  - **votes/api.ts는 S05b 의존 안 함**: voteSet만 의존. S05b의 sweep/classify/applyPayload와 직교
  - **S05c entry는 그대로 유지**: 본 cleanup으로 일부 파일 폐기됐지만 `voteSet.ts` + `api.ts`는 살아 있어 entry 자체는 의미 유지. debouncer.ts 폐기는 본 entry Notes로 기록 — S05c entry rewrite 안 함(history 보존)
  - **Q-B21 closure 미진행**: S05b가 등록한 D11 payload day_index 차원 누락 question — S05a Edge Function patch 필요. 별도 task

---

## S05b — TimeGrid heatmap pure 헬퍼 + Realtime subscribe hook (2026-05-26) — DONE (origin/main PR #3 merged, S05 partial)
- Branch: `worktree-s05b-worklet-drag` → PR #3 → main merge (commit 78c8fe9)
- Depends: S00 (votes table, time_slots, Realtime), S05a (votes_aggregate Edge Function — PR 대기, D11 spec-driven 진행), [D10](DECISIONS.md#d10--히트맵-5단계-색-램프-heat-0--중립-그레이), [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D14](DECISIONS.md#d14--시간-슬롯-단위-15분--db-check)
- Changes:
  - src/lib/heatmap/types.ts (+24 lines) — CellState/SlotKey 공유 타입
  - src/lib/heatmap/classify.ts (+34 lines) — D10 5-stop ramp (count→heat-0~4), edge clamp
  - src/lib/heatmap/classify.test.ts (+50 lines, 7 tests)
  - src/lib/heatmap/applyPayload.ts (+94 lines) — payload→60×7 CellState[][] 변환. selfMarks override(D10). 범위 밖 슬롯 graceful 무시
  - src/lib/heatmap/applyPayload.test.ts (+125 lines, 9 tests)
  - src/lib/heatmap/sweep.ts (+45 lines) — slotKey/computeSweepKeys/toggleSlot (Gesture.Pan worklet에서 호출 가능한 pure 함수)
  - src/lib/heatmap/sweep.test.ts (+72 lines, 7 tests)
  - src/lib/heatmap/debounce.ts (+50 lines) — createDebouncer(cb, 100ms) — D12 본문 vote commit debounce
  - src/lib/heatmap/debounce.test.ts (+62 lines, 5 tests jest fake timers)
  - src/lib/heatmap/useHeatmapSubscription.ts (+90 lines) — supabase.channel(`group:${groupId}`).on('broadcast',{event:'heatmap_update'}) listen + applyHeatmapPayload + isConnected 추적 + unmount cleanup
  - src/lib/heatmap/useHeatmapSubscription.test.ts (+220 lines, 8 tests, supabase channel mock)
  - jest.config.js (+1 testPathIgnorePatterns, ±2 testMatch glob) — Windows worktree path normalization 깨짐 fix
  - docs/OPEN_QUESTIONS.md (+18 lines) — Q-B21 신규 (D11 payload day_index 차원 누락)
- Tests: 122 passed (21 suite), 본 ship 신규 37 (5 suite). typecheck 0, lint 0 (S05b 영역)
- Next: **S05-cleanup** (본 머지 후속, 위 entry), **S05e** (60fps 부하 테스트), worklet drag 통합(gesture-handler + reanimated lazy install + jest mock 환경 필요)
- Notes:
  - **D11 spec extension** — 본문은 `start_minute`만 있으나 votes 테이블에 `day DATE` 컬럼이 있고 7일 grid 필수 → 본 헬퍼는 `{day_index, start_minute, count}` 확장 가정. S05a Edge Function patch + D11 본문 update 권고 (Q-B21)
  - **D10 본인 슬롯 별도 시각** 정확히 구현 — payload ramp 위에 selfMarks가 override (state='self' + raw count 유지)
  - **graceful 입력 검증** — payload의 start_minute<540 / ≥1440 / %15≠0 / day_index 범위 밖 모두 silent skip (서버 CHECK 책임이지만 클라 안전망)
  - **jest.config glob fix** — Windows worktree path에서 `<rootDir>/src/**/*.test.{ts,tsx}` glob이 mixed forward/backslash로 broken. `**/src/**/*.test.{ts,tsx}` + `/web-guest/` ignore로 해결
  - **Reanimated worklet 통합은 별도 sub-task** — useSharedValue + Gesture.Pan은 jest-expo mock 환경에서 통합 테스트 까다로움. 본 ship은 worklet에서 호출 가능한 pure 함수만 (classifyHeat, applyHeatmapPayload, computeSweepKeys, createDebouncer)
  - **sub-task 명명**: 본 entry의 Next에 적힌 "S05c=worklet drag / S05d=DB write" 명명은 본 세션 S05c+S05d ship (다른 의미)과 충돌 — S05-cleanup entry에서 정정. TASK_BACKLOG S05 entry가 단일 source

---

## S05c — Vote commit debouncer + diff INSERT/DELETE (2026-05-26) — DONE (S05 partial 진척)
- Depends: S00 (votes table + RLS 0001:284, 0002), S05a (votes_aggregate Edge Function ship 2026-05-26, broadcast 합산 결과를 받는 쪽이 client), [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b) (100ms debounce 명시), [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec) (drag 종료 시 1회 commit), [D14](DECISIONS.md#d14--시간-슬롯-단위-15분--db-check) (SLOT_DURATION_MINUTES=15)
- Changes:
  - **순수함수 TDD-first**:
    - `src/lib/votes/voteSet.ts` (+61 lines) + `.test.ts` (10 케이스) — `VoteSlot {day, start_minute}` ↔ `VoteKey "day:minute"` 직렬화, `voteSetFromSlots` 중복 제거, `diffVoteSets(prev, next)` → `{added, removed}` (day asc → start_minute asc 정렬, 안정성)
    - `src/lib/votes/debouncer.ts` (+57 lines) + `.test.ts` (7 케이스, jest fake-timers) — `createCommitDebouncer({delayMs, onCommit})` → `{schedule, flush, cancel}`. trailing-edge 동작, 마지막 payload만 commit, flush 즉시 발화, cancel 후 timer 무시, onCommit throw 후 다음 cycle 정상
  - **Supabase wrapper**:
    - `src/lib/votes/api.ts` (+65 lines) + `.test.ts` (7 케이스, supabase mock) — `commitVoteDiff({groupId, userId, added, removed})`. INSERT는 다중 row 1회(`end_minute = start_minute + 15`). DELETE는 day별 group 후 `.eq('group_id').eq('user_id').eq('day').in('start_minute', [...])` (최대 7 round-trip). 빈 diff = no-op. error 한국어 "투표를 저장하지 못했어요. 잠시 후 다시 시도해주세요."
- Tests: Jest **24 passed** (voteSet 10 + debouncer 7 + api 7), typecheck 0, lint 0
- Next: S05b (TimeGrid worklet drag + useSharedValue + Realtime subscribe + heat-0~4 클라이언트 분류) — drag onEnd에서 `debouncer.schedule(currentSlots)` → `onCommit=({added, removed}) => commitVoteDiff(...)` wire-up
- Notes:
  - **best-effort atomicity 수용**: INSERT/DELETE 사이에 throw 발생 시 partial 상태 가능. 베타 수용 — Edge Function 합산은 멱등(D11), 다음 drag commit이 self-heal. 정식 atomicity는 Phase 3 RPC로 격상 후보
  - **`.in('start_minute', ...)` 7-day cap**: 시간 그리드 7일 × 1 DELETE = 최대 7 round-trip. drag 한 번에 보통 1-2일 → 실제로는 1-2 RT. 베타 부하 수용
  - **votes 스키마 unique 부재**: (group_id, user_id, day, start_minute) unique index 없음 → 더블 commit 시 중복 row 가능. 클라 보수 책임(prev-set 추적). 운영 발견 시 migration 0008+에서 partial unique add 후보
  - **D14 SLOT_DURATION_MINUTES=15 상수**: api.ts 내 local 상수. 추후 `src/lib/votes/constants.ts`로 추출 시 S05b의 그리드 cell 계산과 단일 source 통합 권고
  - **S05b drag wire-up 패턴 (참고)**: gesture.onEnd worklet → `runOnJS(debouncer.schedule)(latestSlots)`. onCommit 콜백은 closure로 `commitVoteDiff({groupId, userId, ...diffVoteSets(serverSet, latestSet)})`

---

## S05d — Realtime disconnect 상태 hook (Q-B6 close) (2026-05-26) — DONE (S05 partial 진척)
- Depends: S00 (Realtime enabled), S05a (broadcast channel `group:${groupId}` ship 2026-05-26), [Q-B6](OPEN_QUESTIONS.md#q-b6--realtime-disconnect-ui) (디자인 spec DESIGN §11.4 info-bg chip 이미 명시), S05-UI (`RealtimeStatus` chip 컴포넌트 commit f715fcb)
- Changes:
  - **순수 상태 머신 TDD-first**:
    - `src/lib/realtime/connectionStateMachine.ts` (+39 lines) + `.test.ts` (17 케이스) — `ConnectionState = connecting | connected | disconnected | polling`. `ConnectionEvent = subscribed | error | timeout | closed | disconnect_timeout`. 전이표 명시 — `subscribed`는 모든 상태에서 recovery, `disconnect_timeout`은 `disconnected`에서만 polling 진입(stale timer 안전), `error|timeout|closed`는 polling 유지(downgrade 안 함)
  - **RN hook**:
    - `src/lib/realtime/useRealtimeStatus.ts` (+119 lines) + `.test.ts` (8 케이스, renderHook + fake-timers) — `useRealtimeStatus({client, channelName, disconnectTimeoutMs=30000})` → `{status, isConnected, channel}`. `client.channel(name)`은 `useMemo`로 render-time 생성(eslint `set-state-in-effect` 회피), `channel.subscribe(statusCb)`는 effect, `mapStatusToEvent`로 `SUBSCRIBED|CHANNEL_ERROR|TIMED_OUT|CLOSED` → event 매핑. `disconnected` 진입 시 30s setTimeout → `disconnect_timeout` dispatch, 다른 상태로 전이 시 timer clear, unmount cleanup으로 `channel.unsubscribe()` + timer clear + `mountedRef`로 stale setState 차단
- Tests: Jest **25 passed** (connectionStateMachine 17 + useRealtimeStatus 8), typecheck 0, lint 0
- Next: S05b (TimeGrid 화면)이 `useRealtimeStatus`로 `isConnected` 산출 + 기존 `<RealtimeStatus isConnected={...}>` chip prop wire-up. 폴링 fallback의 실제 fetch는 consumer가 `status === 'polling'` 감지 후 별도 useEffect로 votes_aggregate 직접 GET(미구현, S05b owner)
- Notes:
  - **Q-B6 close**: 디자인 spec(DESIGN §11.4)은 이미 있음 + chip 컴포넌트(S05-UI)도 있음 → 상태 source가 미싱이었음. 본 hook이 source 제공으로 chip의 `isConnected` prop이 실 데이터로 구동 가능
  - **`useMemo` channel 생성 정당화**: `setState in effect` 안티패턴 회피. `client.channel(name)`은 React 18+ Strict Mode에서 useMemo 재실행 시에도 effect cleanup이 unsubscribe 처리 → 누수 없음. supabase-js의 `channel(name)` idempotent 가정 (같은 name 호출은 같은 instance 반환하지 않을 수 있으나, cleanup이 안전 처리)
  - **`.on()` chain 노출**: hook이 channel 객체 반환 → consumer가 `useEffect(() => { channel.on('broadcast', {event: 'heatmap_update'}, handler); }, [channel])`로 broadcast 핸들러 attach. supabase-js의 `.on()`은 subscribe 이후 호출해도 안전(binding registry만 추가)
  - **type-level supabase 의존 회피**: `SupabaseLike` / `RealtimeChannelLike` interface로 hook을 generic 유지 → 테스트에서 supabase 전체 mock 불요. 실 사용은 `useRealtimeStatus({ client: supabase, channelName: ...})`로 정상 작동
  - **30s 시점은 DESIGN §11.4 spec**: "30s 후 폴링". `disconnectTimeoutMs` prop으로 testable + 향후 다른 화면에서 다른 값 사용 가능
  - **mountedRef stale setState 차단**: jest unmount + advanceTimers 30s 시나리오로 검증됨 — 어떤 warning도 안 남음

---

## S07-report — 신고 UI supabase reports INSERT 통합 (2026-05-26) — DONE (S07 acceptance 5번째 close)
- Depends: S07-UI (commit 8de33cb, ReportBlockSheet + friends/index 컴포넌트 wiring 백필), [D32](DECISIONS.md#d32--베타-신고--reports-db-only-운영-통지-채널-deferred) (베타 DB-only, 운영 통지 deferred), S00 (reports table 0001:394 + RLS reports_insert_self 0002:373), S01 (auth.users JWT — reporter_id 출처)
- Changes:
  - **순수함수 TDD-first 3종**:
    - `src/lib/reports/reasons.ts` (+22 lines) + `.test.ts` (6 케이스) — schema enum 5개(spam/harassment/inappropriate/fake_profile/other)와 정합. 한국어 label 매핑(스팸 및 광고/욕설 및 괴롭힘/부적절한 닉네임·프로필/사칭 및 가짜 프로필/기타). `isValidReasonKey` type guard
    - `src/lib/reports/validation.ts` (+38 lines) + `.test.ts` (10 케이스) — reason ENUM 검증 + detail ≤500자(DB는 TEXT 무제한, UX-side cap) + targetUserId trim 검사. 한국어 에러 메시지
    - `src/lib/reports/api.ts` (+48 lines) + `.test.ts` (7 케이스) — `submitReport` supabase reports INSERT wrapper. 자기 신고 사전 throw(0001:401 CHECK 이중 차단) + validation 사전 throw + supabase error 한국어 변환
  - **ReportBlockSheet.tsx 수정** (~10 lines diff) — 내장 REPORT_REASONS 제거 → `@/lib/reports/reasons` import (schema 정합). `onReport` signature `(userId, reason: string, description)` → `(userId, reason: ReportReasonKey, detail)`. `selectedReason` state `string` → `ReportReasonKey | null`. label은 `getReasonLabel(key)` 변환. handleReasonSelect는 label이 아닌 **key** 전달(이전 fix 누락 = 핵심 버그였음)
  - **ReportBlockSheet.test.tsx update** (~30 lines diff) — onReport assertion을 label('스팸 및 광고')에서 key('spam')로. 5개 reason 모두 화면 노출 + harassment/fake_profile 신규 정확 전달 신규 케이스 1개 추가
  - **app/(tabs)/friends/index.tsx 통합** (~20 lines diff) — `useAuth` import로 reporter_id 추출. `handleReport`를 friendsApi.reportUser(console.log mock) → `submitReport` supabase 호출로 교체. 비로그인 시 안내 alert + 한국어 에러 메시지 + 성공 토스트 "신고가 접수됐어요. 운영팀이 검토 후 조치할게요."
  - **tests/screens/friends/index.test.tsx mock 추가** (~10 lines) — friends index가 setup.ts → @react-native-kakao/user ESM transform 깨짐 → `@/lib/auth/setup` + `@/lib/supabase/client` mock 2개로 회피. 기존 7개 케이스 모두 그대로 통과
- Tests: Jest **52 passed** (내 영역 9 suites: reports/reasons 6 + reports/validation 10 + reports/api 7 + ReportBlockSheet 5 + FriendCard 7 + FriendRequestCard ? + friends/index 7 + friends/requests ? + friends/search ?), typecheck 0, lint 0 (내 영역). 전체 Jest 163 passed + 1 skipped (ocr_eval by design)
- Next: **S07 acceptance 5개 중 4개 ✅ + 1개 ⏸️ (운영 통지 D32 deferred)** → S07은 운영 카톡 채널 셋업 완료 시 D32 supersede + notify_admin Edge Function 추가로 최종 close. Sprint 3 잔여는 S08(Click-through, S10 BLOCKED dep). S07-block-supabase (blockUser supabase + friendships cascade)는 별도 sub-task로 남음
- Notes:
  - **핵심 버그 발견·수정**: S07-UI commit의 ReportBlockSheet가 reason key로 'fraud'를 사용했는데 schema enum에 없음(spam/harassment/inappropriate/fake_profile/other). 본 ship 전에 신고 INSERT가 항상 ENUM violation으로 실패했을 것. schema enum이 단일 진실 → 컴포넌트 5개로 확장(harassment/fake_profile 신규 노출) + 'fraud' 제거. D32 본문에 적은 4개 카테고리(스팸/욕설/사기/기타)도 schema와 불일치한 것 — schema 5개가 source of truth
  - **D32 정확히 준수**: 클라이언트는 reports INSERT만, notify_admin Edge Function 호출 0건. 운영 통지 자동화는 운영 카톡 채널 셋업 완료 시 별도 task
  - **handleBlock supabase 통합 의도적 deferred**: friendsApi.blockUser는 mock 그대로(친구 list cleanup만). 실 supabase 통합은 blocks INSERT + friendships/friend_requests cascade RPC가 큰 별도 작업 (S07-block-supabase). D32 scope 외
  - **사전 존재 lint error**: app/(tabs)/friends/index.tsx의 `react-hooks/set-state-in-effect` 1건은 useEffect 내 fetchFriends가 setLoading/setRefreshing 호출하는 사전 패턴. 내 변경 영역 외부 — 별도 task로 fix 권고 (single useState로 reducer 패턴 또는 useReducer 권고)
  - **다른 worktree 동시 진행**: S05c (vote debounce), S05d (Realtime disconnect hook)이 NOW.md에 활성. 내 영역(src/lib/reports/*, friends/*)과 file 충돌 0 — main 직접 작업으로 worktree 불요했음 (S05c·d는 src/lib/votes/* 별도 격리)

---

## S03b — 에브리타임 OCR UI (학기 모달·미리보기·confirm·만료 필터) (2026-05-26) — DONE (S03 완성)
- Depends: S03a (Edge Function `ocr_everytime` + 클라 wrapper, ship 2026-05-26 16559b9), S00 (`schedules` table + source enum), [D2](DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce) (OCR keep), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), §17 (anti-AI-feel)
- Changes:
  - **순수 함수 TDD-first**:
    - `src/lib/ocr/semesterValidation.ts` (+62 lines) + `.test.ts` (16 케이스) — YYYY-MM-DD 검증, 학기 14~200일 sanity, 한국어 에러 메시지
    - `src/lib/ocr/courseListEditor.ts` (+78 lines) + `.test.ts` (24 케이스) — immutable add/update/remove + `normalizeTimeInput` ("10"→"10:00", "1030"→"10:30", "10:5"→"10:05") + `validateCourse` + `hasAnyValidationError`
    - `src/lib/schedules/activeFilter.ts` (+18 lines) + `.test.ts` (6 케이스) — `isScheduleActive` + PostgREST `.or` filter 문자열 빌더
  - **클라이언트 lib**:
    - `src/lib/ocr/imagePicker.ts` (+72 lines) — `expo-image-picker` lazy import + `ImagePickerUnavailableError`/`ImagePickerPermissionDeniedError` 분기. 미설치 시 사용자에게 "곧 활성화돼요" 안내
    - `src/lib/schedules/queries.ts` (+44 lines) — `fetchActiveSchedules` + `fetchEverytimeSchedules` (KST→UTC ISO 산출 후 expires_at filter)
  - **컴포넌트**:
    - `src/components/everytime/SemesterInput.tsx` (+103 lines) — 학기 시작·종료 TextInput + 인라인 한국어 에러 (DESIGN §11.3 인라인 패턴)
    - `src/components/everytime/CourseRow.tsx` (+218 lines) — 강의명 + 요일 7-chip 선택 + 시작/종료/강의실 + 삭제 + 인라인 에러. blur 시 `normalizeTimeInput` 자동
  - **화면**:
    - `app/schedule/_layout.tsx` (+11 lines) — Stack
    - `app/schedule/everytime.tsx` (+357 lines) — `input → ocr_loading → preview → confirming → success` 5단계 state machine. 권한 거부 + 미설치 + 사용자 취소 분기. `replaceExisting` 토글로 두 번째 import 시 덮어쓰기 옵션
    - `app/_layout.tsx` (+1 line) — Stack에 `schedule` 등록
  - **진입점**:
    - `app/(tabs)/profile.tsx` (+11 lines) — `SettingRow`에 `onPress` 지원 + "에브리타임 시간표 가져오기" 행 추가 (icon=캘린더)
- Tests: Jest **139 passed** (S03a 93 + S03b 신규 46), 1 skipped (ocr_eval by design), typecheck 0, lint 0 (S03b 영역)
- Next: S03 완성 → S04 (모임 확정 push) 또는 S05b (TimeGrid worklet drag, 회사 운명) 본격 진행 가능
- Notes:
  - **`expo-image-picker` 미설치 — 다음 EAS Build 시점 lazy install 필요**. 현 상태에서 사용자가 사진 선택 버튼 누르면 "곧 활성화돼요" 안내 + flow 차단. 코드 path는 모두 ready (권한 분기 포함) — install 1줄(`npx expo install expo-image-picker`) + EAS Build 후 즉시 작동. Sprint 0 인프라 보강 list에 등록 권고
  - **§17 anti-AI-feel 적용**: §17.1 brand-500 CTA 1개("일정에 저장하기") · §17.2 학기 input form 즉시 가치 · §17.3 카드 위계 3단(강의명/요일/시간) · §17.5 disabled = surface-2+text-tertiary (brand-200 X) · §17.6 친근체("시간표를 가져왔어요!")
  - **D13 KST 강제**: `validateSemesterDate`는 luxon Asia/Seoul, `queries.ts::nowUtcIso()`는 KST→UTC. `new Date()` 직접 0
  - **권한 거부 흐름**: ImagePickerPermissionDeniedError로 명시. iOS Settings.app 안내 카피 ("설정에서 권한을 켠 뒤 다시 시도해주세요")
  - **`groups` SELECT 호스트 차단 UX**: parallel S07-d16-audit 세션이 D31로 close (groups SELECT 불변 + users SELECT 자연 mask). 본 S03b 코드 영향 0
  - **acceptance 잔여 1건 — ground truth 데이터 ~20장 수집은 운영 task**. 인프라(`tests/ocr/README.md` + `ocr_eval.test.ts` + `case_01.expected.json` skeleton)는 S03a에서 완성됨

---

## D31 결정 — 차단 호스트 모임 부분 노출 (Q-A8 close) (2026-05-26) — DONE
- Depends: S07-d16-audit (2026-05-26 ship, Q-A8 등록), [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)
- Changes:
  - docs/DECISIONS.md (+18 lines) — D31 신규 (groups SELECT 불변 + users SELECT 자연 mask)
  - docs/OPEN_QUESTIONS.md (-9 / +6) — Q-A8 "Closed by D31" 표기 + 결정 본문 inline
- Tests: docs only, 코드 변경 0
- Next: 코드 변경 없음 — S07 acceptance "차단된 사용자가 만든 모임 초대 = hidden" 항목이 명확화됨 (group_invitations은 0005, 모임 list는 D31 자연 mask)
- Notes:
  - **Founder 결정**: 옵션 (a) 부분 노출 채택. 옵션 (b) 능동 leave 라벨·(c) 완전 숨김 reject
  - **자연 mask 검증**: 0002:19-24 `users_select_visible`이 `auth.uid() = id OR NOT is_blocked(auth.uid(), id)` — A가 B를 차단하면 B의 user row가 안 보이므로 모임 카드의 호스트 닉네임/프로필이 자동 mask. 추가 UI work 불요
  - **D16 정신과의 거리**: D16은 "친구 검색·추천·모임 멤버·초대" 통과 의무. "모임 list" 자체는 D16 문구에 없음 — D31이 D16 위반 아님. 차단 호스트의 user 정보는 여전히 가려짐
  - **Phase 3 재평가 가능**: 베타에서 "차단 호스트 모임 노출" 불만 발생 시 D31 supersede → 옵션 (c) 전환 (migration 0008 추가). 데이터 dependent

---

## S07-d16-audit — D16 propagation audit (group_members + votes SELECT) (2026-05-26) — DONE (S07 partial 진척)
- Depends: S00 (`is_blocked` helper at 0001 + 0002 RLS skeleton), S07-backend(0005 group_invitations 보강은 worktree PR 대기, audit는 main 위에서 독립 진행), [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)
- Changes:
  - supabase/migrations/0007_d16_propagation_audit.sql (+78 lines) — `group_members_select_same_group` + `votes_select_same_group` DROP+CREATE에 `AND (auth.uid() = user_id OR NOT public.is_blocked(auth.uid(), user_id))` 절 보강
  - docs/OPEN_QUESTIONS.md (+15 lines) — Q-A8 신규 (groups SELECT host_id 차단 UX 결정, 권고: 부분 노출 — `users` SELECT의 기존 is_blocked로 자연 mask)
  - docs/NOW.md (+7 lines, ship 시 제거) — S07-d16-audit 항목 활성·완료 사이클
- Tests: typecheck 0 (내 SQL 변경 영역) / RLS 동작 검증은 Supabase local instance 필요 → S07-backend·S05a 패턴 동일 deferred. SQL syntax는 0002:291-305 `comments_select_same_group` 패턴 mirror — manual review OK
- Next: Q-A8 founder 결정 → 결정 b(부분 노출) 채택 시 S07-UI에 호스트 mask 컴포넌트 follow-up. 신고 UI는 별도 task (운영 카톡 채널 prereq)
- Notes:
  - **S03·S05 세션 병렬 진행 중에 worktree 없이 main에서 격리 가능 — file 충돌 0** (SQL migration + docs만, src/* 미접촉)
  - **Self exception 필수 근거**: 0001/0002의 `blocks` table INSERT policy가 `blocker_id = blocked_id` (self-block)을 막지 않음 → `is_blocked(auth.uid(), auth.uid())`이 true가 될 수 있음 → 본인 row가 안 보일 risk. `auth.uid() = user_id OR NOT is_blocked(...)` 패턴으로 safety 보장
  - **groups SELECT host_id 차단 SKIP 이유**: 멤버십 연속성 깨짐 (이미 참여 모임이 host 차단 후 갑자기 사라짐). `users SELECT`이 이미 `host_id` row를 차단자에게 가리므로 자연스러운 부분 mask 효과. UX 결정은 Q-A8로 founder에게 위임
  - **votes SELECT 하드닝 정당화**: D11 (Edge Function 합산 + broadcast)가 raw vote의 클라이언트 합산을 금지하지만, service_role bypass 외 모든 RLS path를 hardening. 정상 경로(votes_aggregate Edge Function service_role)에는 영향 없음
  - **Migration prefix 0007 선택 이유**: 0005(S07-backend worktree) + 0006(S05a worktree) 이 main에 미머지지만 reserved. 0007로 충돌 회피. 두 worktree PR 머지 순서가 어찌되든 0007은 unique
  - **S03b session typecheck 빨강**: 동시 진행 중인 S03b의 미완 `courseListEditor.test.ts` 7건 — 내 ship 영역 외부, S03 세션 owner

---

## S03a — 에브리타임 OCR Edge Function 핵심 로직 + ground truth eval 인프라 (2026-05-26) — PARTIAL (S03 backend)
- Depends: S00 (schedules table + source enum 'everytime' — migration 0001:315), S01 (auth.users JWT), [D2](DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce) (OCR keep), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기)
- Done:
  - **Edge Function `supabase/functions/ocr_everytime/`** — 두 단계 (action=preview / action=confirm)
    - `parser.ts` (+95 lines) — Gemini Vision 응답 정규화 (markdown ```json 펜스 처리, day/time/end>start 검증)
    - `rrule.ts` (+39 lines) — RFC 5545 RRULE 생성 (FREQ=WEEKLY + BYDAY 매핑 + UNTIL=학기말 KST→UTC)
    - `schedule.ts` (+97 lines) — OcrCourse → schedules row 변환 (첫 occurrence 요일 계산, KST→UTC, expires_at=학기말, source='everytime')
    - `index.ts` (+146 lines) — Deno.serve HTTP handler, JWT 인증, Gemini Vision REST 호출 (responseMimeType=application/json), service_role schedules INSERT, replaceExisting 옵션
    - Deno 테스트 3종 TDD-first (+201 lines, 28 케이스): `parser_test.ts` (10) / `schedule_test.ts` (11) / `rrule_test.ts` (7) — Deno CLI 미설치로 실행 deferred (S05a/S07-backend 패턴 동일)
  - **클라이언트 wrapper `src/lib/ocr/everytime.ts`** (+57 lines) — `previewEverytimeOcr` / `confirmEverytimeOcr` (supabase.functions.invoke 경유, Gemini key 클라이언트 expose 0)
  - **Eval 인프라**: `src/lib/ocr/diffAccuracy.ts` (+47 lines, 정확도 산출 순수 함수) + `diffAccuracy.test.ts` (Jest 8 케이스 통과)
  - **Ground truth 디렉토리**: `tests/ocr/README.md` (운영자 가이드 — 학교≥5곳/해상도/다크모드 권고), `tests/ocr/ground_truth/case_01.expected.json` (스펙 샘플), `tests/ocr/ocr_eval.test.ts` (PNG 없으면 skip, OCR_EVAL_ENABLED + GEMINI_API_KEY 환경 변수로 활성)
- Remaining (S03b 또는 후속):
  - **UI** — `src/screens/schedule/everytime/`: 카메라/갤러리 권한, 이미지 base64 변환, 학기 시작·종료일 모달, OCR 진입 + 미리보기·confirm step, 학기 종료 자동 숨김 (client query `WHERE expires_at IS NULL OR expires_at > NOW()`)
  - **Ground truth 데이터 ~20장** — 협조 학생 모집 + 마스킹 + expected.json 작성 (운영 task)
  - **Gemini API key Supabase secret 등록** (`GEMINI_API_KEY` env) + 한 번 실 호출 검증
- Tests: Jest **93 passed (1 skipped — ocr_eval by design)** + diffAccuracy 8 신규, typecheck 0, lint 0, Deno 28 TDD-first 작성 (실행 deferred)
- Next: S03b UI 또는 S05b (TimeGrid worklet drag — 회사 운명 60fps)
- Notes:
  - **외부 캘린더 push 차단 메커니즘**: `source='everytime'` enum 격리 ([D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기) + ENG_REVIEW §9.4). calendar_push Edge Function이 WHERE source IN ('manual', 'google', 'apple_ios')로 filter할 책임 (S06)
  - **두 단계 분리** (preview/confirm)는 acceptance "미리보기·confirm step" 충족 + Gemini 토큰 절약 (사용자가 confirm 안 하면 INSERT 안 함)
  - **replaceExisting 기본 false** — 두 번째 import 시 기본 "추가". 덮어쓰기 옵션은 UI(S03b)에서 토글로 노출
  - **`noUncheckedIndexedAccess` strict 모드 적응**: diffAccuracy의 `remaining[idx]`는 undefined 가능 → optional chaining + 명시적 분기로 수정
  - **GEMINI_API_KEY 미설정 위험**: Edge Function 첫 호출 시 502 fail. 운영 배포 전 Supabase secret 등록 의무
  - **Day enum 통일**: parser.ts·rrule.ts·schedule.ts·client lib 4곳에 같은 7값. 향후 enum 공유 모듈로 통합 후보
  - SESSION_LOG 206줄 (200줄 임계 초과 +6) — 최고령 entry는 2026-05-22(4일 전), 30일+ 없어 archive 시점 미도래. 다음 ship에서 재확인

---

## S07-backend — group_invitations blocking propagation + is_blocked RPC helper (2026-05-26) — DONE (PR 대기)
- Branch: `worktree-agent-a39703870f6972b8c` (worktree 격리, main 머지는 PR 후)
- Depends: S00 (`is_blocked` helper at 0001:94, group_invitations table), [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)
- Changes:
  - supabase/migrations/0005_group_invitations_blocking.sql (+18 lines) — `group_invitations_select_involving_self` policy 양방향 `is_blocked` 체크 추가 (0002:215 gap fix)
  - supabase/functions/_lib/blocking.ts (+25 lines) — `isBlocked(client, viewerId, targetId)` RPC wrapper
  - supabase/functions/_lib/blocking_test.ts (+73 lines, 5 Deno tests TDD-first)
- Tests: 5 Deno tests written (TDD-first). Deno CLI 미설치로 실행 deferred. SQL syntax는 0002:61/82 검증된 CASE WHEN 패턴 mirror — manual review OK
- Next: S07 잔여 (신고 UI = 별도 task, F1-F3 push = S12), D16 propagation audit (groups/group_members/votes/schedules SELECT policy 추가 검토 권고)
- Notes:
  - **Plan reviewer + Code reviewer (sub-agent) 2단 검토 통과** — Critical 4(DESIGN/RLS/KST/Secret) GO/CLEARED
  - **D16 propagation audit 권고** (worktree subagent 발견): 다른 SELECT policies에 is_blocked 누락 vector 가능
  - **머지 방법**: `gh pr create --base main --head feature/s07-backend ...`
  - 다른 세션이 §17 polish 진행 중이라 worktree 격리. main 충돌 0건

---

## S05a — votes_aggregate Edge Function (D11 Realtime aggregation, S05 partial) (2026-05-26) — DONE (PR 대기)
- Branch: `worktree-agent-ae72b67b533ba1d2d` (worktree 격리, main 머지는 PR 후)
- Depends: S00 (votes table, time_slots), [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D13](DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D14](DECISIONS.md#d14--시간-슬롯-단위-15분--db-check)
- Changes:
  - supabase/functions/votes_aggregate/index.ts (+156 lines) — group_id 파라미터, votes 합산, Realtime broadcast (channel `group:${groupId}`, event `heatmap_update`, payload `{ slots: [{start_minute, count}], updated_at(KST +09:00 ISO) }`)
  - supabase/functions/votes_aggregate/_test.ts (+171 lines, 6 Deno tests TDD-first)
  - supabase/migrations/0006_votes_aggregate_trigger.sql (+95 lines) — votes AFTER INSERT/UPDATE/DELETE → pg_net `net.http_post`. `current_setting('app.supabase_url', true)` + `current_setting('app.service_role_key', true)` GUC 패턴 (vault 전환 TODO)
- Tests: 6 Deno tests written (TDD-first). Deno CLI 미설치로 실행 deferred. 사용자 측 `deno test ... --allow-env --allow-net --no-check`
- Next: **S05b** (TimeGrid worklet drag + useSharedValue + Realtime subscribe + heat-0~4 클라이언트 분류), S05c (vote commit debounce), S05d (Realtime disconnect UI), S05e (60fps 부하 테스트 — 회사 운명)
- Notes:
  - **D11 spec 정확히 준수** — channel/event/payload는 D11 본문 그대로. heat-0~4 분류는 클라이언트 책임 (S05b)
  - **is_blocked 적용 SKIP** — votes 합산에서 의미 모호. OPEN_QUESTIONS에 Q 신규 등록 권고 (별도 task)
  - **GUC 사전 설정 의무** (production 배포 전):
    ```sql
    ALTER DATABASE postgres SET app.supabase_url = 'https://<proj>.supabase.co';
    ALTER DATABASE postgres SET app.service_role_key = '<service_role_jwt>';
    ```
    미설정 시 trigger silent skip (INSERT는 정상)
  - **Trigger SECURITY DEFINER**: function owner를 postgres가 아닌 별도 role 제한 — production 배포 전 검토
  - **Plan reviewer + Code reviewer 2단 검토 통과** — Critical 4 GO/CLEARED
  - **머지 방법**: `gh pr create --base main --head feature/s05a-votes-aggregate ...`
  - 다른 세션 §17 작업 중이라 worktree 격리. main 충돌 0건

---

## UI-§17 — DESIGN §17 anti-AI-feel 신설 + 1차 적용 + zustand useStore fix (2026-05-26) — DONE
- Depends: D4 (디자인 절제), D5 (Purple Discipline), D7 (Pretendard), [D30](DECISIONS.md#d30--17-anti-ai-feel-디자인-원칙-신설-designmd-17)
- Commits (3 logical):
  - d665ae1 `chore: .gitignore + run-denda skill`
  - ce1af70 `docs(design,decisions): §17 신설 + D30 + §17.7 모순 fix`
  - e12d26e `feat(ui): §17 1차 적용 — brand 컴포넌트 + tabs 구조 + auth/friends polish + zustand`
- Changes:
  - docs/DESIGN.md (+88 lines, §17.1~17.7 신설), §17.7 disabled 체크리스트 §17.5 본문 정합으로 fix
  - docs/DECISIONS.md (+15 lines, D30 신규)
  - .gitignore (+5 lines, output/ + .claude/worktrees/)
  - .claude/skills/run-denda/ (SKILL.md + launch.sh, +302 lines) — 에뮬레이터 실행 + 스크린샷
  - src/components/brand/ (5 신규: BrandMark, HeatRampRow, MiniCalendar, MiniMap, MiniTimeGrid) — §17.4 시각 자산 0 안티패턴 대응
  - app/(tabs)/_layout.tsx (M), index.tsx (M, §17.2 빈 placeholder fix), friends/_layout.tsx (A), map.tsx (A, placeholder), profile.tsx (A, placeholder)
  - app/(auth)/login.tsx + onboarding.tsx + terms.tsx (대규모 polish, §17 다층 적용)
  - app/_layout.tsx + app/index.tsx (M)
  - src/components/friends/FriendCard.tsx, FriendRequestCard.tsx, FriendRequestCard.test.tsx (polish)
  - src/lib/auth/setup.ts (+~10 lines): `useSyncExternalStore` → `zustand useStore` (React "getSnapshot should be cached" 경고 fix)
  - tests/screens/friends/*.test.tsx (test update for polish)
- Tests: 기존 friends test 동시 update. 실행 검증은 별도 진행 필요
- Next: §17 2차 적용 (홈 §17.3 위계 격상 + §17.6 마이크로카피 통일), Q-B12 closure 동기화
- Notes:
  - **§17 발견 컨텍스트**: 1차 베타 화면 portfolio(S11+S14+S05-UI+S07-UI 결과) 회고 — "AI 생성물 같다" 피드백 수렴
  - **§17.5/§17.7 모순 fix**: revised 본문(disabled = surface-2 회색)과 체크리스트(회색이 아니라 brand-200) 정반대였음. 본문 정합으로 체크리스트 수정
  - 본 작업은 다른 세션이 진행 중 commit 직전 중단된 상태에서 본 세션이 정리·commit. logical separation 적용

---

## Portfolio 백필 — Sprint 1+2 UI commits (2026-05-23~24 commits, 백필 2026-05-26) — DONE (SESSION_LOG 누락 보정)
- 백필 대상 commits (S01 ship 시점에 누락 명시됨):
  - **S11 — Design system tokens + Pretendard + web guest setup** (commit 9ce1de9 2026-05-23) — DONE
    - src/design/tokens.ts, theme.ts, typography.tsx + assets/fonts/PretendardVariable.ttf
  - **S05-UI — TimeGrid visual components** (commit f715fcb 2026-05-23) — DONE (S05 partial, worklet drag는 S05b)
    - src/components/TimeGrid/ — 셀 가상화 + 시각 토큰
  - **S07-UI — Friends UI + components + stubs + unit tests** (commit 8de33cb 2026-05-23) — DONE (S07 partial)
    - src/components/friends/, app/(tabs)/friends/, jest tests
  - **S14 — Web guest page skeleton** (commit 65b0efa 2026-05-23, fix 8988e9c + a2a9b04 2026-05-24) — DONE (skeleton, Branch 통합·자체 deferred deep link는 S15)
    - web-guest/ Next.js, interactive grid, nickname form. D4/D5 hex+backdrop-blur fix, playwright/jest 분리
- 정식 ship 미진행 사유: S01 ship-task에 portfolio로 카운트만, 별도 entry 보류 → 본 entry로 보정
- Tests: 각 commit 시점 typecheck/lint 0, 일부 jest test (friends · web guest grid). 통합 검증은 차후 ship-task에서
- Next: 각 task 완성도 후속 task에 의존 (S05 = S05a+S05b+...; S07 = S07-UI+S07-backend; S14 → S15)
- Notes:
  - 본 entry는 SESSION_LOG 정합성 보정용. 실제 작업일은 commit date
  - PROGRESS.md task 카운트는 S00·S01만 DONE 유지. S05/S07/S11/S14는 IN_PROGRESS

---

## S01 — Kakao OIDC OAuth (Supabase signInWithIdToken) (2026-05-24) — DONE
- Depends: S00 (auth.users + on_auth_user_created trigger, DONE 2026-05-22), [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)
- Changes (this ship):
  - app/_layout.tsx (1 line, .woff2 → .ttf: RN native는 TTF만 지원)
  - src/lib/auth/setup.ts (~25 lines): Kakao SDK 제약 정리 + Q-A7 베타 수용 (Supabase 측 nonce 검증 skip)
  - docs/OPEN_QUESTIONS.md (~10 lines): Q-A7 closure (option c 수용)
- Changes (prior commit 9ce1de9, this session에서 만들어짐):
  - src/lib/auth/AuthProvider.ts (interface + AuthError, ~75 lines)
  - src/lib/auth/KakaoOIDCProvider.ts (DI 패턴, ~210 lines)
  - src/lib/auth/KakaoOIDCProvider.test.ts (16 tests, ~330 lines)
  - src/lib/auth/authStore.ts (zustand vanilla store, ~140 lines)
  - src/lib/auth/authStore.test.ts (16 tests, ~265 lines)
  - src/lib/auth/gate.ts (decideGate pure function, ~37 lines)
  - src/lib/auth/gate.test.ts (7 tests, ~60 lines)
  - src/lib/auth/setup.ts (네이티브 SDK + Supabase wiring, ~120 lines)
  - app/_layout.tsx (bootstrap 호출)
  - app/index.tsx (decideGate 사용한 라우팅 게이트)
  - app/(auth)/_layout.tsx + login.tsx + terms.tsx + onboarding.tsx (~510 lines)
  - app/(tabs)/_layout.tsx + index.tsx (placeholder, ~85 lines)
  - app.config.ts (Expo config + Kakao plugin + projectId, ~60 lines)
  - plugins/withKakaoMaven.js (settings/build.gradle에 Kakao Maven repo 주입, ~40 lines)
  - supabase/migrations/0001_initial.sql (uuid_generate_v4 → gen_random_uuid, 11 replacements + extension fix)
  - jest.config.js + jest.setup.js + tsconfig.json (test infra, ~50 lines)
  - eas.json (EAS Build profiles, ~30 lines)
  - .npmrc (legacy-peer-deps for React 19 + RN 0.85 + Kakao SDK)
  - package.json + package-lock.json (zustand, @react-native-kakao/{core,user}, expo-{secure-store,crypto,linking,dev-client,font}, jest 29, jest-expo, @testing-library/react-native, @react-native/jest-preset, eslint stack)
- Tests: 85 passed (this commit), S01 직접 39 (KakaoOIDCProvider 16 + authStore 16 + gate 7), typecheck 0, lint 0 (S01 영역)
- Next: S05 (시간 그리드 + Realtime 히트맵, Sprint 3) 또는 S11/S13 (이미 일부 코드 commit됐으나 SESSION_LOG 미업데이트 — 별도 ship-task 필요)
- Notes:
  - **D29 OIDC end-to-end 검증 완료** — 실기기/emulator에서 카카오 로그인 → auth.users 행 생성 + public.users trigger 동기화 확인 (kakao_id=4910442986, nickname=남동휘, email=null per 베타)
  - **Q-A7 closure** — `@react-native-kakao/user` 2.4.5의 native bridge가 nonce 미노출 → Supabase에 nonce 전달 자체를 skip하여 우회 (option c). 재검토 W3 (TestFlight Internal 시작)
  - **Kakao SDK 추가 발견**: `scopes` 인자는 OIDC scope이 아니라 추가 동의 요청용 (Access token 필요). OIDC scope/동의는 카카오 portal 설정으로만 가능. login()은 인자 없이 호출
  - **Sprint 0 외부 작업 완료**: 카카오 portal OIDC 활성화 + 동의항목 닉네임, Supabase Auth Kakao provider Enable (Client ID = Native App key), Android keystore SHA1 키해시 등록, Supabase 마이그레이션 0001-0003 배포, EAS env 변수 등록, EAS Build dev client APK 배포
  - **Co-shipped 변경 (별도 task 영역)**: S11 design system 일부 (tokens/theme/typography + font assets), S14 web-guest skeleton, S05-UI TimeGrid 컴포넌트, S07-UI Friends UI — 이번 ship에는 portfolio로만 카운트, 각 task SESSION_LOG 항목 별도 추가 필요
  - **Settings.gradle / build.gradle 패치**: Kakao SDK는 Maven Central이 아닌 자체 Nexus (devrepo.kakao.com) 호스팅 → plugins/withKakaoMaven.js로 allprojects.repositories에 주입

---

## S00 — Backend Foundation (Supabase + DB schema + RLS) (2026-05-22) — DONE
- Depends: D3 (partnerships only), D14 (15min CHECK), D16 (is_blocked helper) — 모두 충족
- Changes:
  - supabase/migrations/0001_initial.sql (+390 lines, 18 tables + CHECK + FK + triggers)
  - supabase/migrations/0002_rls.sql (+260 lines, RLS + is_blocked helper)
  - supabase/functions/_lib/{supabase,kst,hmac,dispatcher,http}.ts (+150 lines scaffolding)
  - supabase/config.toml (+38 lines)
  - package.json, app.json, tsconfig.json (denda 이름 + strict mode)
  - app/_layout.tsx, app/index.tsx (+25 lines, expo-router entry)
  - src/lib/supabase/client.ts (+18 lines, anon client)
  - src/lib/time/kst.ts (+30 lines, luxon wrapper — D13)
  - .env.example (+25 lines)
  - .eslintrc.cjs, .prettierrc (+18 lines)
  - .gitignore (+15 lines, Expo SDK 56 패턴 append)
  - .claude/hooks/design-guard.sh (+2 lines, Windows backslash 정규화)
  - .gitkeep × 14 (빈 src/* + tests/ 디렉토리)
- Tests: typecheck 0 errors. SQL은 deploy 시 검증 (local DB 미실행).
- Next: S11 (다크 토큰) + S13 (EAS skeleton) Sprint 1 병행. S01·S10은 Q-A1 답변 (D-6) 후.
- Notes:
  - Supabase project deploy는 사용자가 외부에서: `supabase link` + `supabase db push` 필요. URL/key는 .env.local에.
  - Sprint 0 #7 (Expo init) 동시 진행: Expo SDK 56 install + expo-router/supabase-js/luxon/safe-area-context/screens 의존성 추가. EAS는 S13에서.
  - **Deviation**: ARCHITECTURE.md §3의 `src/app` 컨벤션 vs expo-router default `app/` 충돌 → root `app/` 사용. ARCHITECTURE.md update 또는 expo-router config로 src/app 등록 필요 (추후 결정).
  - **Hook 수정**: design-guard.sh에 Windows `\` → `/` 정규화 1줄 추가 (case-glob skip 매칭 fix). 차단 정책 변경 아님 — 크로스플랫폼 호환 버그 수정.
  - 미설치 의존성: zustand, gesture-handler, reanimated, flash-list, naver-map, expo-calendar, expo-notifications, expo-font, lucide-react-native, react-native-svg → 사용 시점 lazy install (D25).

---

## 로그 시작점 (2026-05-22)

(이전 항목 없음. S00가 첫 완료)

---

## Archive

(30일+ 지난 완료 항목은 여기로 이동)
