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

### S03 에브리타임 OCR — S03b UI 진행 중
- **상태**: S03a DONE 2026-05-26 (Edge Function + 순수 함수 3종 + eval 인프라). S03b UI 시작
- **다음 단계 (S03b)**: 순수 함수 TDD (semesterValidation / courseListEditor / activeSchedulesFilter) → CourseRow + SemesterPicker 컴포넌트 → `app/schedule/everytime/` 화면 → 프로필 진입 버튼
- **블로커**: 없음. `expo-image-picker` 미설치 → 첫 ship에서 picker를 lazy-load stub function으로 추상화 + Notes로 추적
- **마지막 update**: 2026-05-26 KST (S03b 시작)
