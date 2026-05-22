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

## 로그 시작점 (2026-05-22)

(아직 완료된 태스크 없음. Sprint 0 인프라 셋업 진행 중)

---

## Archive

(30일+ 지난 완료 항목은 여기로 이동)
