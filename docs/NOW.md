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

### S13 EAS Build + 인증서 + 실기기 cold start 측정 (D25)
- **상태**: 시작 — 실기기 연결 대기
- **다음 단계**: Android 실기기 USB 디버깅 ON + 케이블 연결 → `adb devices` 확인 → `npx expo run:android --device` 로컬 빌드 → cold start 측정 → 결과로 acceptance 진척 판단
- **블로커**: 실기기 미연결 (`adb devices` 빈 목록). Apple Developer 가입(Q-B20)은 iOS acceptance에만 영향 — Android trail은 단독 진행 가능
- **마지막 update**: 2026-05-27