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

### S06 Calendar Sync — UI 마무리 (reauth modal + applesync wire-up 잔여)
- **상태**: S06-ui-first-time-modal ✅ ship됨. 다음 sub-task = S06-ui-reauth-modal
- **다음 단계**: ReauthModal Jest 테스트 + 구현 (partial_fail_list 감지 + signInGoogleAndUpload 재호출) → 프로필 화면 wire-up → ship → useApplePendingSync app/_layout.tsx 전역 wire-up
- **블로커**: 없음 (backend + lib + first-time-modal 모두 ship됨)
- **마지막 update**: 2026-05-26 (KST) — S06-ui-first-time-modal ship 직후


