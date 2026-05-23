# 된다 앱 하네스 — In-Progress 트래킹 도입 작업 지시서

> **수신**: 작업을 수행할 AI 에이전트 (Claude Code 등)
> **발신**: 하네스 진단 AI
> **선행 작업**: `HARNESS_REFACTOR_SPEC.md`, `HARNESS_SSOT_FOLLOWUP_SPEC.md` (적용 완료)
> **목표**: 6단계(Always Have an Agent Running) 진입을 위한 **라이브 상태 트래킹 문서** 신설
> **작업 유형**: 하네스 신규 능력 추가 (앱 코드 변경 아님)
> **작성일**: 2026-05-22

---

## §0. 컨텍스트 — 왜 이 작업이 필요한가

### 0.1. 현재 하네스의 빈자리

현재 트래킹 문서는 다음 차원을 커버한다:

| 차원 | 문서 | 갱신 시점 |
|---|---|---|
| 완료된 태스크 | `SESSION_LOG.md` | `/ship-task` 시 prepend |
| Sprint burn-down + KPI | `PROGRESS.md` | `/ship-task` 시 +1 |
| Backlog 목록 | `TASK_BACKLOG.md` | 사용자가 수동 update |

빠진 차원: **현재 활성 상태(in-progress) + 다음 트랜지션 큐**.

이 빈자리가 다음 세 시나리오에서 문제가 된다:

1. **중단 후 재개**: 어제 S05 50% 작업하다 멈춤. 오늘 새 세션이 어디서부터 다시 시작할지 모름. SESSION_LOG는 commit 후에만 기록되므로 중간 상태가 휘발.

2. **다중 worktree 병렬 작업 (Phase A)**: worktree A에서 S07, worktree B에서 S11 동시 진행 중일 때 통합 뷰가 없음. 각 worktree의 commit history는 독립적이라 cross-worktree 상태 파악 불가.

3. **Hashimoto의 transition 30분**: "다음에 큐잉할 slow thing이 뭐지?"를 묻고 즉시 task를 큐잉하는 습관. TASK_BACKLOG는 S05/S07 같은 큰 단위라 30분짜리 sub-task가 안 보임.

### 0.2. 해결 — `docs/NOW.md` 신설

라이브 상태판 한 장으로 위 세 시나리오를 모두 커버한다. 핵심 설계 원칙:

- **휘발성**: 작업 완료 시 SESSION_LOG로 promote하고 자기 자신에서 삭제. 누적되지 않는다.
- **50줄 hard limit**: 컨텍스트 부담 최소화. 50줄 초과 시 사용자에게 정리 권유 알림.
- **단일 위치**: `docs/NOW.md`. PROJECT_CONTEXT.md §9 참조 인덱스에 추가.
- **다중 worktree 지원**: 각 worktree 또는 에이전트별 섹션을 명확히 구분.
- **트랜지션 큐 내장**: "다음 slow thing 후보" 별도 섹션. 30분짜리 sub-task 단위.

### 0.3. 절대 변경 금지

- `SESSION_LOG.md`, `PROGRESS.md`, `TASK_BACKLOG.md`의 기존 책임·형식 변경 금지. NOW.md는 **새 책임**을 맡고, 기존 문서는 자기 일을 그대로 한다.
- `DECISIONS.md` 어떤 D{N}도 추가·수정·삭제 금지. NOW.md 도입은 결정 변경이 아니다.
- 앱 코드, archive 변경 금지.
- 기존 hook(`design-guard.sh`) 동작 변경 금지.

### 0.4. 작업 전 체크리스트

- [ ] `git status` 깨끗한지 확인
- [ ] `wc -l CLAUDE.md docs/PROJECT_CONTEXT.md docs/SESSION_LOG.md docs/PROGRESS.md` — 현재 필수 읽기 총 줄 수 기록 (작업 후 비교용)
- [ ] 새 브랜치: `git checkout -b feature/now-tracking`

---

## §1. 작업 범위

```
Task 1: docs/NOW.md 신설 (템플릿 + 사용 규칙)
Task 2: .claude/skills/start-task/SKILL.md 수정 (NOW.md에 항목 추가하는 절차)
Task 3: .claude/skills/ship-task/SKILL.md 수정 (NOW.md 항목을 SESSION_LOG로 promote)
Task 4: CLAUDE.md "모든 세션 공통 (필수)" 4→5개로 확장 (NOW.md 추가)
Task 5: docs/PROJECT_CONTEXT.md §9 참조 인덱스에 NOW.md 추가
Task 6: 50줄 임계값 hook 또는 ship-task 내 체크 추가
```

세 Task는 의존성이 있다: 1 → (2, 3) → (4, 5) → 6. 1 commit으로 묶지 말고 최소 3개로 분리 권장 (1+2+3 / 4+5 / 6).

---

## §2. Task 1 — `docs/NOW.md` 신설

### 2.1. 파일 경로

`docs/NOW.md` (새 파일)

### 2.2. 초기 내용 (그대로 사용)

```markdown
# Now — 현재 진행 중

> AI 세션 시작 시 가장 먼저 읽는 라이브 상태판.
> 중단/재개 시 컨텍스트 복원의 단일 진실 위치.
>
> **규칙**:
> - 작업 시작 시 항목 추가 (/start-task가 자동 처리)
> - 작업 완료 시 SESSION_LOG로 promote하고 여기서 삭제 (/ship-task가 자동 처리)
> - 50줄 초과 시 정리 권유 알림 (오래된 큐 항목 prune)
> - 누적 history는 SESSION_LOG가 담당. 여기는 **활성 상태만**.

---

## 🟢 활성 작업 (Active)

(현재 진행 중인 작업 없음 — 새 세션은 PROGRESS.md의 active Sprint 확인 후 /start-task로 시작)

---

## 📥 트랜지션 큐 (Next slow things)

(Hashimoto 6단계 패턴: 자리를 비우기 전 큐잉할 30분~2시간짜리 sub-task. 큰 태스크는 TASK_BACKLOG.)

(비어 있음)

---

## 📝 형식 참조

### 활성 작업 항목 형식
\`\`\`markdown
### {worktree 이름 또는 "main"} — {태스크 코드} {태스크 제목}
- **상태**: {진행률 또는 단계 — 예: "drag gesture 완료, vote commit 미완"}
- **다음 단계**: {바로 다음에 할 일 1~2 항목}
- **블로커**: {없으면 "없음", 있으면 Q-{ID} 또는 D{N} 참조}
- **마지막 update**: {YYYY-MM-DD HH:MM KST}
- **세션 ID** (선택): {agent 식별자 — 다중 worktree 시}
\`\`\`

### 트랜지션 큐 항목 형식
\`\`\`markdown
- [ ] {30분~2시간짜리 sub-task 설명} ({예상 소요})
  - 컨텍스트: {왜 이게 필요한지 한 줄}
  - 결과: {완료 시 어디에 어떻게 반영}
\`\`\`
```

### 2.3. 검증

```bash
wc -l docs/NOW.md  # 약 35~45줄 (목표 50줄 이하)
test -f docs/NOW.md && echo "✓ created"
```

---

## §3. Task 2 — `start-task` SKILL 수정

### 3.1. 파일 경로

`.claude/skills/start-task/SKILL.md`

### 3.2. 절차 추가

기존 절차의 **3번 이후, 4번 (TodoWrite 분해) 이전**에 새 단계 삽입.

기존 구조(짧게):
```
1. 다음 TODO 태스크 확인 (lazy load 진입점)
2. 의존성 확인 (BLOCKED 체크)
3. 관련 문서 읽기
4. TodoWrite로 sub-task 분해
5. TDD — 테스트 먼저
...
```

새 3.5단계 삽입:

```markdown
### 3.5. NOW.md에 활성 작업 항목 추가

태스크 시작 시 [NOW.md](../../../docs/NOW.md)의 `## 🟢 활성 작업` 절에 새 항목 추가:

\`\`\`markdown
### main — S{NN} {태스크 제목}
- **상태**: 시작
- **다음 단계**: {acceptance criteria의 첫 번째 항목}
- **블로커**: 없음
- **마지막 update**: {YYYY-MM-DD HH:MM KST}
\`\`\`

다중 worktree 작업 시:
- `git rev-parse --show-toplevel`로 현재 worktree 경로 확인
- 메인 worktree면 `main`, 그 외엔 branch 이름 (예: `feature/s07-friends`)을 항목 제목에 사용
- 이미 같은 worktree의 항목이 NOW.md에 있으면 **새로 추가하지 말고 기존 항목 update** (작업 전환의 경우)

NOW.md 항목 추가 후 git add는 하지 말 것 — 다음 `/ship-task` 시점에 다른 변경과 함께 commit.
```

### 3.3. 검증

```bash
grep -A 3 "3.5" .claude/skills/start-task/SKILL.md | head -10
# 새 단계가 추가됐는지
```

---

## §4. Task 3 — `ship-task` SKILL 수정

### 4.1. 파일 경로

`.claude/skills/ship-task/SKILL.md`

### 4.2. 절차 수정

기존 절차에서 **2번(SESSION_LOG prepend) 직후**에 새 단계 삽입.

기존 구조:
```
1. 모든 그린 확인
2. SESSION_LOG.md 항목 prepend
3. PROGRESS.md 업데이트
...
```

새 2.5단계:

```markdown
### 2.5. NOW.md에서 활성 항목 제거 (promote 완료)

[NOW.md](../../../docs/NOW.md)의 `## 🟢 활성 작업` 절에서 방금 완료된 태스크의 항목을 **삭제**한다.

이유: 정보는 이미 SESSION_LOG에 promote됐다. NOW.md는 활성 상태만 유지한다. 중복하면 NOW.md가 무한 누적된다.

검증: 삭제 후 `grep "S{NN}" docs/NOW.md`가 비어 있어야 함 (트랜지션 큐의 sub-task 언급은 OK).

다중 worktree 시: 이 worktree의 항목만 삭제. 다른 worktree의 항목은 그대로 둔다.
```

또한 **기존 5.5단계 (SESSION_LOG 길이 체크) 다음에 NOW.md 길이 체크 추가**:

```markdown
### 5.6. NOW.md 길이 체크

`wc -l docs/NOW.md`로 줄 수 측정:
- **50줄 초과** 시 사용자에게 알림:
  > "NOW.md가 {N}줄입니다. 활성 작업과 트랜지션 큐를 합쳐 50줄 이하로 유지하는 것이 권장됩니다.
  > - 오래된 활성 작업이 있다면 SESSION_LOG로 promote 또는 명시 삭제
  > - 트랜지션 큐의 오래된 항목 prune
  > - 정리할까요?"
- 사용자 결정에 따라 정리 또는 유보.

50줄을 넘는 NOW.md는 컨텍스트 부하만 늘리고 라이브 상태판의 효용이 떨어진다.
```

### 4.3. git commit 절차 수정

기존 6번 git commit 절에서 `git add` 라인에 NOW.md 추가:

```bash
git add {구체적 파일 경로} {SESSION_LOG.md} {PROGRESS.md} {TASK_BACKLOG.md} {NOW.md} [DECISIONS.md] [OPEN_QUESTIONS.md]
```

### 4.4. 자동 체크리스트에 NOW.md 추가

기존 "자동 체크리스트" 절의 항목에 추가:
```markdown
- [ ] NOW.md에서 완료된 활성 항목 제거 (Task promote)
- [ ] NOW.md 50줄 이하 유지
```

---

## §5. Task 4 — `CLAUDE.md` 필수 읽기 확장

### 5.1. 파일 경로

`CLAUDE.md` (루트)

### 5.2. 수정 위치

`## 새 세션 읽기 순서` → `### 모든 세션 공통 (필수, 4개)` 절.

### 5.3. 변경 내용

기존:
```markdown
### 모든 세션 공통 (필수, 4개)
1. **이 파일** (CLAUDE.md) — 정책
2. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — 제품·페르소나·게이트·금지선·결정 (~105줄)
3. [docs/SESSION_LOG.md](docs/SESSION_LOG.md) — 최근 완료 3건
4. [docs/PROGRESS.md](docs/PROGRESS.md) — 활성 게이트

`docs/TASK_BACKLOG.md`는 `/start-task` 호출 시 lazy 로드.
```

변경 후:
```markdown
### 모든 세션 공통 (필수, 5개)
1. **이 파일** (CLAUDE.md) — 정책
2. [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) — 제품·페르소나·게이트·금지선·결정 (~105줄)
3. [docs/NOW.md](docs/NOW.md) — 현재 진행 중 (라이브 상태판, ≤50줄)
4. [docs/SESSION_LOG.md](docs/SESSION_LOG.md) — 최근 완료 3건
5. [docs/PROGRESS.md](docs/PROGRESS.md) — 활성 게이트

`docs/TASK_BACKLOG.md`는 `/start-task` 호출 시 lazy 로드.

읽기 순서 이유: PROJECT_CONTEXT가 "무엇을 만드는가"라면, NOW.md는 "지금 어디까지 왔는가". 중단된 세션을 재개할 때 컨텍스트 복원의 단일 진실. 다중 worktree 시 통합 상태판.
```

### 5.4. 검증

```bash
wc -l CLAUDE.md  # 약 76~80줄 (현재 74 + 약 3~5줄)
grep -c "docs/NOW.md" CLAUDE.md  # 최소 1
```

CLAUDE.md가 90줄을 넘지 않는지 확인. 90줄 hard limit (선행 작업 기준).

---

## §6. Task 5 — `PROJECT_CONTEXT.md` §9 참조 인덱스 update

### 6.1. 파일 경로

`docs/PROJECT_CONTEXT.md`

### 6.2. 수정 위치

`## §9. 더 깊이 보려면 (참조 인덱스)` 절의 표.

### 6.3. 추가할 행

기존 표 마지막 행 (현재 sprint 진척) 위에 새 행 추가:

```markdown
| 현재 진행 중 (active) | [NOW.md](NOW.md) (활성 작업 + 트랜지션 큐, ≤50줄) |
| 현재 sprint 진척 | [PROGRESS.md](PROGRESS.md) + [TASK_BACKLOG.md](TASK_BACKLOG.md) |
```

### 6.4. 검증

```bash
grep "NOW.md" docs/PROJECT_CONTEXT.md  # §9 표에 등장
```

---

## §7. Task 6 — 50줄 임계값 강제 (선택)

### 7.1. 옵션 A: ship-task 내 알림만 (권장)

이미 Task 3의 §5.6에서 처리됨. 추가 작업 없음.

### 7.2. 옵션 B: hook으로 결정적 강제 (보수적 추가)

`design-guard.sh`에 NOW.md 검증 추가 — **사용자 결정 필요** 항목.

**제안 패턴** (사용자 승인 시에만 추가):

```bash
# --- NOW.md 길이 ---
case "$FILE_PATH" in
  */docs/NOW.md)
    line_count=$(wc -l < "$FILE_PATH")
    if [ "$line_count" -gt 80 ]; then
      # 80줄을 hard limit, 50줄을 soft limit으로
      violations+=("NOW.md: ${line_count}줄. 80줄 hard limit 초과. 활성 작업 promote 또는 큐 prune 필요.")
    elif [ "$line_count" -gt 50 ]; then
      warn "NOW.md: ${line_count}줄. soft limit(50) 초과. 정리 권유."
    fi
    ;;
esac
```

**주의**: 옵션 B는 NOW.md 작성 중에도 hook이 작동하므로 false positive 가능. 일단 옵션 A로 진행하고, 운영 1주일 후 사용자가 옵션 B 여부 결정 권장.

---

## §8. 검증 시나리오 (반드시 실행)

작업 완료 후 다음 3개 시나리오를 실제 실행해 통과 여부 확인:

### 8.1. 시나리오 1 — 새 태스크 시작 시 NOW.md 자동 update

```bash
# 1. NOW.md 활성 작업 절이 비어 있는지 확인
grep -A 2 "## 🟢 활성 작업" docs/NOW.md

# 2. /start-task SKILL.md를 시뮬레이션 (사람이 수동으로 따라가도 OK)
#    가상 태스크 S99 시작 시 NOW.md에 항목이 추가되는지 확인
#    실제 코드 실행은 불필요 — SKILL.md 절차가 명확하면 OK

# 3. /start-task SKILL.md의 3.5단계가 NOW.md 추가를 명령적으로 지시하는지 확인
grep -A 5 "NOW.md에 활성 작업" .claude/skills/start-task/SKILL.md
```

### 8.2. 시나리오 2 — ship-task 시 NOW.md에서 promote

```bash
# 1. /ship-task SKILL.md의 2.5단계가 NOW.md 삭제를 명령적으로 지시하는지
grep -A 5 "NOW.md에서 활성 항목 제거" .claude/skills/ship-task/SKILL.md

# 2. git commit 절차에 NOW.md가 git add 대상으로 포함됐는지
grep "NOW.md" .claude/skills/ship-task/SKILL.md | grep -i "git add\|add"
```

### 8.3. 시나리오 3 — 필수 읽기에 NOW.md 등장

```bash
# CLAUDE.md의 "모든 세션 공통" 절에 NOW.md가 5개 중 하나로 포함
grep -A 6 "모든 세션 공통" CLAUDE.md | grep "NOW.md"

# PROJECT_CONTEXT.md §9에도 등장
grep -A 20 "## §9" docs/PROJECT_CONTEXT.md | grep "NOW.md"
```

3개 시나리오 모두 통과해야 작업 완료.

---

## §9. 완료 기준 (Definition of Done)

### 9.1. 정량

| 지표 | 목표 | 검증 |
|---|---|---|
| docs/NOW.md 존재 | 1 | `test -f docs/NOW.md` |
| NOW.md 초기 줄 수 | ≤50 | `wc -l docs/NOW.md` |
| CLAUDE.md 총 줄 수 (변경 후) | ≤90 | `wc -l CLAUDE.md` |
| 필수 읽기 5개 합계 | ≤500줄 | CLAUDE + PROJECT_CONTEXT + NOW + SESSION_LOG + PROGRESS |
| start-task SKILL에 NOW.md 절차 | 1 | grep |
| ship-task SKILL에 NOW.md 절차 + git add | 2 | grep |

### 9.2. 정성

- [ ] NOW.md가 휘발성(SESSION_LOG로 promote 후 삭제) 원칙을 명확히 선언
- [ ] 다중 worktree 시나리오가 NOW.md 항목 형식에 반영 (worktree 이름 또는 "main")
- [ ] 트랜지션 큐 절이 Hashimoto의 transition 30분 패턴을 명시
- [ ] 50줄 hard limit이 ship-task에 강제됨 (옵션 A) 또는 hook에 (옵션 B)
- [ ] SESSION_LOG, PROGRESS, TASK_BACKLOG의 기존 책임·형식 변경 없음 (`git diff` 비어 있음)

### 9.3. 기능 회귀

- [ ] 기존 hook 동작 보존: D5 hex 차단, D13 new Date() 차단 시나리오 통과
- [ ] CLAUDE.md의 절대 규칙 7개 변경 없음
- [ ] DECISIONS.md 변경 없음

---

## §10. 절대 금지 사항

1. **새 D{N} 결정 생성 금지** — NOW.md 도입은 결정이 아니다. CLAUDE.md/PROJECT_CONTEXT.md 등 인덱스에만 추가.
2. **SESSION_LOG.md, PROGRESS.md, TASK_BACKLOG.md 형식·책임 변경 금지** — NOW.md는 *새* 책임이지 기존 책임 흡수가 아님.
3. **NOW.md를 누적 history로 사용 금지** — 완료된 항목은 *즉시* SESSION_LOG로 promote하고 삭제. 누적되면 SESSION_LOG와 중복되며 효용 0.
4. **앱 코드 변경 금지**.
5. **archive 변경 금지**.
6. **hook의 기존 D4·D5·D7·D13·D18·ko-KR·Phase 3 패턴 변경 금지** — 옵션 B 선택 시에도 *추가만*.
7. **CLAUDE.md 90줄 초과 금지** — 선행 작업의 hard limit. NOW.md 추가로 76~80줄이 적절.

---

## §11. 사용자에게 보고할 결정 필요 항목

각 항목은 작업 받는 AI가 진행 중 사용자에게 물을 것:

1. **Task 6 옵션 A vs B**: ship-task 알림만 (A) vs hook 강제 (B). 기본 권장 A.
2. **다중 worktree 시 worktree 이름 규칙**: branch 이름 그대로 사용? 또는 짧은 별칭(`s07`, `s11`)? 솔로 운영이라 branch 이름이 충분하면 그대로.
3. **트랜지션 큐의 prune 정책**: 며칠 이상 묵은 큐 항목은 자동 삭제? 또는 수동? 기본 권장: 수동 (사용자가 의도적으로 큐잉한 항목이므로).

---

## §12. 보고 형식

```markdown
## NOW.md 도입 작업 완료

### 변경된 파일
- docs/NOW.md: 신규 ({N}줄)
- .claude/skills/start-task/SKILL.md: {이전}→{이후}줄
- .claude/skills/ship-task/SKILL.md: {이전}→{이후}줄
- CLAUDE.md: 74→{N}줄
- docs/PROJECT_CONTEXT.md: 133→{N}줄
- (옵션 B 선택 시) .claude/hooks/design-guard.sh: 171→{N}줄

### 정량 지표
- NOW.md 초기 줄 수: {N}/50 (hard limit)
- CLAUDE.md: {N}/90 (hard limit)
- 필수 읽기 5개 합계: {N}/500

### 검증 시나리오 결과
- 시나리오 1 (start-task 시 NOW 추가): ✓/✗
- 시나리오 2 (ship-task 시 NOW promote): ✓/✗
- 시나리오 3 (필수 읽기 5개): ✓/✗

### 사용자 결정 필요 항목 (§11)
- [선택지 명시 + 권장값]

### 발견 사항 (있을 시)
- ...
```

---

## §13. 참고 — 자료조사 컨텍스트

이 문서가 따르는 원칙:

- **Hashimoto의 Step 6** (Always Have an Agent Running): "There should always be an agent doing something" — 사용자 idle 시 에이전트가 long-running task. 그러려면 "다음에 큐잉할 slow thing"이 즉시 보여야 함. → NOW.md의 트랜지션 큐 절이 이 역할.
- **Stripe Minions worktree 패턴**: 각 worktree가 독립 진행 상태를 갖되, 통합 뷰가 가능해야 함. → NOW.md의 활성 작업 절에 worktree 식별자 명시.
- **VILA Lab Claude Code 분석**: 9단계 query loop 중 "상태 초기화"가 트랜잭션 시작점 로깅. → NOW.md가 세션 간 트랜잭션 상태판 역할.
- **Böckeler의 guides/sensors**: NOW.md는 guides(피드포워드) — 새 세션에 "여기서부터" 가이드. 동시에 sensors(피드백) — `/ship-task` 시점에 진척 확인.
- **Code with Claude 2026 캐시 적중률**: 정적인 PROJECT_CONTEXT는 캐시되고, 동적인 NOW.md만 자주 변경되므로 캐시 효율 보존.

작업 받는 AI는 단순 mechanical 적용이 아니라, NOW.md가 *살아 있는 문서*임을 인지하고 작성한다. 운영 1~2주 후 형식 조정이 필요할 수 있다는 점도 사용자에게 미리 안내.

---

**문서 작성**: 2026-05-22
**예상 작업 시간**: 1~1.5시간 (Task 1 신설 15분, Task 2/3 SKILL 수정 30분, Task 4/5 인덱스 update 15분, Task 6 옵션 A는 추가 작업 없음, 검증 15분)
**최종 검토**: 사용자 (시나리오 3개 통과 + 운영 1주일 후 형식 피드백)
