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

### S03 에브리타임 OCR (Gemini Vision) — backend(S03a) DONE / UI(S03b) + ground truth 데이터 remaining
- **상태**: S03a 완료 (Edge Function `ocr_everytime` + 순수 함수 3종 + Deno 28 테스트 + eval 인프라). 자세한 ship 항목 SESSION_LOG 참조.
- **다음 단계 (S03b)**: `src/screens/schedule/everytime/` UI — 카메라/갤러리, 이미지 base64, 학기 시작·종료 모달, 미리보기/confirm, expires_at 만료 필터링
- **블로커**: 없음. 단 운영 task `GEMINI_API_KEY` Supabase secret 등록 + ground truth ~20장 수집은 별 트랙
- **마지막 update**: 2026-05-26 KST (S03a ship)
