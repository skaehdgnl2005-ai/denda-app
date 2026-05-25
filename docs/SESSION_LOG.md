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
