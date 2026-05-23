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
