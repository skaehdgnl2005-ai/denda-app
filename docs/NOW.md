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

### S05c — Vote commit debounce ([D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec))
- **상태**: 시작 (S05a Edge Function ship 2026-05-26, S05b worklet drag 미진행이지만 독립 단위)
- **다음 단계**: voteSet 순수 함수 TDD → debouncer (jest fake-timers) TDD → commitVoteDiff supabase api wrapper
- **블로커**: 없음 — S05b drag 통합은 후속 (S05b가 createCommitDebouncer를 onEnd에서 호출)
- **Scope**: drag end → 100ms debounce → diff INSERT/DELETE 단일 commit 단위까지. TimeGrid drag 결합은 S05b가 owner
- **마지막 update**: 2026-05-26 KST

### S05d — Realtime disconnect 상태 hook (Q-B6 close)
- **상태**: 시작 (RealtimeStatus chip 컴포넌트는 S05-UI에서 이미 있음, 미싱 piece는 연결 상태 source)
- **다음 단계**: connection 상태 머신 TDD (connecting→connected→disconnected→polling, 30s 타이머) → useRealtimeStatus hook (Supabase channel 구독 + STATUS callback 매핑)
- **블로커**: 없음
- **Scope**: 상태 머신 + hook까지. 폴링 fallback의 실제 fetch는 consumer(S05b)가 onPoll callback에서
- **마지막 update**: 2026-05-26 KST
