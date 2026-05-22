---
name: ship-task
description: 태스크 완료 처리. SESSION_LOG·PROGRESS·TASK_BACKLOG 업데이트 + git commit. 모든 테스트 통과 후에만 호출.
---

# /ship-task

태스크 완료를 단일 일관된 흐름으로 마무리. 추적성 확보 + 다음 태스크 unblock.

## 절차 (반드시 순서대로)

### 1. 모든 그린 확인
다음 모두 통과해야 진행:
- `npm test` → Jest 통과, 0 failures
- `npx tsc --noEmit` → 0 errors
- `npx eslint` → 0 errors
- (해당 시) Maestro / Playwright / Deno test 통과
- (해당 시) Storybook visual diff 통과

**하나라도 실패하면 멈춤** — 사용자에게 보고 + 수정 후 재호출.

### 2. SESSION_LOG.md 항목 prepend
[SESSION_LOG.md](../../../docs/SESSION_LOG.md) **상단**에 추가 (가장 최근 위로):

```markdown
## S{NN} — {태스크 제목} ({YYYY-MM-DD}) — DONE
- Depends: {S{NN} 또는 D{N} 또는 Q-{ID}, 모두 충족 확인}
- Changes:
  - {파일 경로} ({+/-} {lines})
  - {파일 경로} ({+/-} {lines})
- Tests: {N passed}, lint 0, typecheck 0
- Next: {다음 태스크 S{NN+1} 또는 unblock 대상}
- Notes: {특이사항 — 결정 변경, 발견된 risk, 부분 완료 등}
```

날짜는 KST 오늘 (Asia/Seoul 기준 yyyy-MM-dd).

### 3. PROGRESS.md 업데이트
[PROGRESS.md](../../../docs/PROGRESS.md):
- Build Burn-down 표의 현재 sprint 진척
- Task 진척 카운트 +1
- Lane별 카운트 (TODO -1, DONE +1)
- 마지막 업데이트 날짜 변경

### 4. TASK_BACKLOG.md Status 변경
[TASK_BACKLOG.md](../../../docs/TASK_BACKLOG.md) 해당 태스크의 `Status: TODO` → `Status: DONE`

### 5. 새 OPEN_QUESTIONS / DECISIONS 발견 시 추가
태스크 진행 중 새 의문이나 결정이 생겼다면:
- 결정 → [DECISIONS.md](../../../docs/DECISIONS.md)에 새 D{N}
- 질문 → [OPEN_QUESTIONS.md](../../../docs/OPEN_QUESTIONS.md)에 새 Q-{카테고리}{N}
- SESSION_LOG의 Notes에 cross-reference

### 5.5. SESSION_LOG 길이 체크 (auto-archive 트리거)

`wc -l docs/SESSION_LOG.md`로 줄 수 측정:
- 200줄 이상이면 사용자에게 archive 권유 알림:
  > "SESSION_LOG.md가 {N}줄입니다. 30일+ 항목을 `docs/archive/SESSION_LOG_archived.md`로 이동을 권장합니다. (선언적 정책 → 강제 정책 격상, P2-9)"
- 사용자 결정에 따라:
  - **이동**: 30일+ 된 항목 (날짜가 오늘 KST - 30일 이전) 잘라내 `docs/archive/SESSION_LOG_archived.md` 하단에 append → 현재 commit에 함께 staging
  - **유보**: 다음 ship 때 다시 알림

### 6. git commit (변경 파일만 명시적으로)
```bash
git add {구체적 파일 경로} {SESSION_LOG.md} {PROGRESS.md} {TASK_BACKLOG.md} [DECISIONS.md] [OPEN_QUESTIONS.md]
git commit -m "$(cat <<'EOF'
ship: S{NN} — {태스크 제목}

{1-2줄 요약: 무엇·왜}

Closes: S{NN}
{관련 D{N} 또는 Q-{ID}}

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

**금지**: `git add .` 또는 `git add -A` (의도치 않은 파일 commit 위험).

### 7. 다음 태스크 unblock 안내
SESSION_LOG의 `Next:` 필드에 적은 다음 태스크가 이제 unblocked인지 확인:
- TASK_BACKLOG에서 그 태스크의 Depends 모두 DONE → 사용자에게 안내
- 사용자가 `/start-task`로 진행 가능

## 부분 완료 (PARTIAL)

태스크의 모든 acceptance를 충족 못 했지만 부분 진행을 commit하고 싶을 때:

```markdown
## S{NN} — {태스크 제목} ({YYYY-MM-DD}) — PARTIAL
- Done: {완료된 부분}
- Remaining: {남은 부분} — 새 sub-task S{NN}.b로 추적
- Next: S{NN}.b
```

TASK_BACKLOG에서 Status는 `IN_PROGRESS` 유지 + 남은 acceptance만 표시.

## 롤백 (REVERTED)

시도했으나 디자인이 안 맞아 되돌릴 때:

```markdown
## S{NN} — {태스크 제목} ({YYYY-MM-DD}) — REVERTED
- Notes: {왜 롤백. 어떤 alternative 가능}
```

git revert + Status: TODO 유지.

## 자동 체크리스트

내부적으로 다음 모두 통과:
- [ ] 테스트 모두 그린
- [ ] typecheck 0, lint 0
- [ ] SESSION_LOG.md 항목 추가
- [ ] PROGRESS.md 카운트 +1
- [ ] TASK_BACKLOG.md Status 변경
- [ ] git commit (specific files)
- [ ] 다음 unblock 태스크 사용자에게 알림
