# Now — 현재 진행 중

> 활성 작업의 라이브 상태판. 중단/재개 시 컨텍스트 복원 단일 위치.
>
> **규칙**:
> - 항목 추가: `/start-task`가 처리 (skill §3.5)
> - 항목 삭제: `/ship-task`가 promote 시 처리 (skill §2.5)
> - 50줄 hard limit. 초과 시 `/ship-task`가 정리 권유 알림.
> - 누적 history는 [SESSION_LOG](SESSION_LOG.md). 여기는 **활성 상태만**.

---

## 🟢 활성 작업

### S14-utils (web-guest 순수 유틸 TDD 도입 + RN spec mirror)
- **상태**: 시작
- **다음 단계**: 3종 순수 유틸 TDD red→green — `web-guest/lib/heatmap.ts`(classifyHeat quartile, RN src/lib/heatmap/classify.ts mirror) + `lib/time.ts`(luxon Asia/Seoul dayOfWeek·formatHeaderDate, D13 강제) + `lib/voteKey.ts`(VoteSlot/voteKey/parseVoteKey/diffVoteSets, RN src/lib/votes/voteSet.ts mirror)
- **블로커**: 없음. jest 환경(jest-environment-jsdom + ts-jest + @testing-library/jest-dom) skeleton에서 이미 셋업됨
- **Scope**: S14 acceptance "시간 그리드(RN과 별도 구현, 같은 동작 spec)" 의 spec drift 방지 — RN classify/voteSet과 quartile/edge-case 정확히 mirror. 컴포넌트 refactor + D13 `new Date()` violation fix + D11 client self-broadcast 제거는 별도 sub-task
- **마지막 update**: 2026-05-26 KST


