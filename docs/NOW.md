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

### S04 모임 확정 + F5 push (backend)
- **상태**: 시작 (D33 dispatcher 결정 + Q-B5 close 완료)
- **다음 단계**: dispatcher.ts stub → real impl (register/dispatch + Promise.allSettled 격리) + Deno test
- **블로커**: 없음 (Sprint 3 잔여 S05 worklet drag와 직교, S04 의존 S00·S05 데이터 layer ready)
- **Scope**: backend only — group_confirm Edge Function + notify_f5 Edge Function + dispatcher impl + 클라 wrapper. UI(`confirm.tsx`)는 S05b 그리드 통합 후 별도 sub-task
- **마지막 update**: 2026-05-26 KST


