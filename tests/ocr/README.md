# OCR Ground Truth — 에브리타임 시간표 (S03)

→ S03 [TASK_BACKLOG](../../docs/TASK_BACKLOG.md#s03--에브리타임-ocr-gemini-vision), [TEST_PLAN §3.4](../../docs/TEST_PLAN.md), [D2 결정](../../docs/DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce) (OCR keep)

## 목적

Gemini Vision OCR 정확도 회귀 측정. 학기 시작 timing이 P1 학생 segment의 핵심 마찰이므로 ([PROJECT_CONTEXT §2](../../docs/PROJECT_CONTEXT.md)), 모델 변경·프롬프트 수정 시 정확도 감소 ≥5pp면 차단.

## 디렉토리 구조

```
tests/ocr/
├── README.md                      (이 파일)
├── ground_truth/
│   ├── case_01.png                # 에브리타임 스크린샷 (운영 task에서 채움)
│   ├── case_01.expected.json      # 기대 결과
│   ├── case_02.png
│   ├── case_02.expected.json
│   └── ... (~20장 target)
└── ocr_eval.test.ts               # Jest로 실행 (PNG 없으면 skip)
```

## Expected JSON 스펙

```json
{
  "semester": {
    "start": "2026-03-02",
    "end": "2026-06-19"
  },
  "courses": [
    {
      "name": "선형대수",
      "day": "MON",
      "start": "10:00",
      "end": "11:30",
      "room": "공학관 401"
    }
  ]
}
```

| 필드 | 타입 | 비고 |
|---|---|---|
| `semester.start` / `semester.end` | YYYY-MM-DD | 학기 입력 모달용 reference. eval은 정확도 100% target |
| `courses[].name` | string | 한국어 강의명 원문 |
| `courses[].day` | enum | `MON`\|`TUE`\|`WED`\|`THU`\|`FRI`\|`SAT`\|`SUN` |
| `courses[].start` / `courses[].end` | HH:MM | 24시간 |
| `courses[].room` | string? | 강의실 (선택) |

## Eval 기준 (TEST_PLAN §3.4)

- **course 정확도 ≥ 90%** — name·day·start·end·room 5개 필드 매치 비율
- **학기 명시 추출 100%** — 학기 시작·종료 추출 정확

샘플 다양성 권고:
- 학교 ≥ 5곳 (서울대 / 연대 / 고대 / 한양 / 건대 등 P1 페르소나 catchment)
- 해상도: 1080×2400 (P1 기기), 1440×3200 (Galaxy 상위)
- 다크 모드 ≥ 4장 (에브리타임 다크 테마 점유율 ↑)
- 학기 ≥ 2학기 (3월·9월 학기 둘 다)

## 실행

```bash
npm test -- tests/ocr/ocr_eval.test.ts
```

PNG 파일이 없으면 모든 케이스가 skip 처리. 운영자가 스크린샷·expected.json 쌍 추가 시 자동으로 picked up.

## 채우는 절차 (운영 task — Sprint 3 안에)

1. 협조 가능한 학생 5명+에게 본인 에브리타임 시간표 캡처 요청 (개인정보 동의 + 사전 동의)
2. 각 캡처를 `case_NN.png`로 저장
3. 사람이 직접 본 결과를 `case_NN.expected.json`으로 작성
4. `npm test -- tests/ocr/ocr_eval.test.ts` 실행 → 정확도 ≥ 90% 통과 확인
5. 실패 케이스는 노트에 기록 + 프롬프트 보강 또는 모델 업그레이드 검토

## 금지 (보안 + 윤리)

- 실명·학번 포함된 캡처 commit 금지 → 마스킹 후 commit
- 동의서 없이 타인의 시간표 캡처 사용 금지
- ground_truth/ PNG는 git LFS 또는 별도 storage 후보 (현 단계는 일반 commit, 학기 끝나면 갱신)
