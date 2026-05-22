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
