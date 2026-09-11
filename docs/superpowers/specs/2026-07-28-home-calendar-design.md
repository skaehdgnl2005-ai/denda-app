# S25 — 홈 = 나만의 캘린더 (설계 SSoT)

> 2026-07-28 · 관련 결정 [D42](../../DECISIONS.md#d42--홈--나만의-캘린더-prd-51-복귀--수동-개인-일정-활성) · DESIGN [§10.6b](../../DESIGN.md)

## 1. 문제

로그인 후 첫 화면이 "인사말 + 보라 CTA 카드 + 모임 리스트"여서 앱이 **모임 목록 앱**처럼 읽혔다. 사용자가 원한 것은 내 캘린더가 주인공인 홈이다.

이는 새 방향이 아니라 **원안 복귀**다. `docs/PRD.md`가 처음부터 이렇게 명세했다:

> §4: **홈**: 캘린더 (월/주) + 내 일정 + 모임 일정 + "지도로 보기" 토글
> §5.1: 월간/주간 전환 가능한 캘린더에 내 일정과 모임 일정을 모두 표시.

이탈이 만든 실제 손실:

- `schedules` 테이블(에브리타임 OCR이 채우는 개인 일정)의 **앱 내 소비처가 0**이었다. 조회 함수 `fetchActiveSchedules`/`fetchEverytimeSchedules`가 작성만 되고 호출부가 없었다 — P1(대학생) 페르소나가 시간표를 OCR로 넣어도 볼 곳이 없었다.
- 수동 개인 일정은 DB(`source='manual'` enum)와 RLS(self 4종)까지 준비돼 있었으나 UI가 없었다.

## 2. 범위 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 표시 범위 | 모임 + 에브리타임 수업 + **수동 개인 일정 CRUD** | 사용자 선택 |
| 홈 구성 | 캘린더 + 선택일 목록 + 다가오는 모임(압축) | Gate #1 진입 동선을 홈에 남긴다 |
| 뷰 전환 | 월간만 | 선택일 목록이 일별 상세를 담당 — 주간 뷰의 한계 실익 대비 컴포넌트·테스트 2배 |
| 보라 CTA 카드 | 제거 | 탭바 중앙 GroupFab과 중복. §17.1 한 화면 brand fill 1개 |
| 외부 캘린더 읽기 | 제외 | [D19](../../DECISIONS.md#d19--calendar-sync-단방향-부분-실패-명시) 단방향(push 전용) 유지. iOS write-only 권한 전제라 뒤집으려면 권한 모델부터 재설계 |

## 3. 아키텍처

```
fetchMyGroups()            ─┐
  (confirmed_start_at,      │   buildCalendarItems()        groupByDate()
   confirmed_end_at,        ├─▶  ───────────────────▶ CalendarItem[] ─▶ Record<dateIso, Item[]>
   places(name) 포함)       │                                            └─▶ monthMarkers()
fetchActiveSchedules(uid)  ─┘
  └─▶ expandSchedules()  (주간 RRULE 전개)
```

마이그레이션 0 · Edge Function 0 · 신규 패키지 0. 테이블·enum·RLS·월 그리드 순수 로직(`buildMonthMatrix`) 모두 기존 자산.

### 3.1 순수 로직

**`src/lib/calendar/recurrence.ts`** — "언제 일어나는가"만 담당.
- `recurrence_rule === null` → 단일 occurrence
- `FREQ=WEEKLY;BYDAY=…;UNTIL=…` → 창 안의 해당 요일 반복 (BYDAY 복수 요일 지원)
- 미지원 FREQ → 첫 occurrence만 (전량 무음 드롭 금지)
- 컷오프: `start_at` 이전 / `UNTIL` 이후 / `expires_at` 만료 — 만료 판정은 기존 `isScheduleActive` 재사용
- 자정 넘는 종료는 `endMinute = 1440` clamp

**`src/lib/calendar/agenda.ts`** — 모임 + 일정을 한 모델로.
- `CalendarItemKind = 'group-confirmed' | 'group-voting' | 'class' | 'personal'`
- 확정 모임: `confirmed_start_at`(UTC) → KST 날짜/분. **UTC→KST 날짜 경계**가 핵심 (15:30Z = 다음 날 00:30 KST)
- 투표 중 모임: 후보 날짜마다 `startMinute = null` 항목
- 정렬: 시간 미정 먼저 → `startMinute` 오름차순
- `monthMarkers`: **수업 제외** (§4 참조)

**`src/lib/schedules/personal.ts`** — 수동 CRUD. KST 입력 → UTC 저장. RLS deny가 조용한 0 rows로 오므로 `setConfirmedPlace` 패턴대로 surface한다.

### 3.2 UI

| 컴포넌트 | 책임 |
|---|---|
| `MonthCalendar` | 읽기 전용 월 그리드 + 마커. 과거 선택 가능·단일 선택·월 이동 무제한 |
| `DayAgenda` | 선택일 목록. 모임 행 → 모임 상세, 개인 행 → 편집 시트, 수업 행 → 읽기 전용 안내 |
| `PersonalScheduleSheet` | 추가/수정 겸용. 15분 단위 시간 선택, 삭제는 ConfirmSheet 한 겹 더 |

`CalendarDatePicker`(모임 후보일 다중선택)와 `MonthCalendar`를 분리한 이유: 과거 선택 가부·다중선택 여부·월 이동 범위가 모두 반대다. 프롭 분기로 합치면 두 용도 모두 읽기 어려워진다. 공유 단위는 `monthMatrix` 순수 로직.

## 4. 시각 결정 3건 (DESIGN §10.6b)

1. **선택 셀에 보라 fill 금지** — `surface-3` 사용. 한 화면 brand fill 1개 규칙(§17.1/D5) 아래 보라는 '모임 확정'에만 남긴다. (CalendarDatePicker가 보라 fill을 쓰는 건 "확정 의도" 다중선택이라 맥락이 다르다.)
2. **월 마커에서 수업 제외** — 매주 반복이라 점을 찍으면 달 전체가 균일하게 칠해져 정보량이 0이 된다. 수업은 선택일 목록에만.
3. **종류 구분은 아이콘이 아닌 텍스트 칩** — `모임 · 확정` / `모임 · 투표 중` / `수업` / `내 일정`. 아이콘 세트를 늘리지 않으면서 §12.6(색 단독 의존 금지)을 자동 충족.

## 5. 상태 처리

- 첫 로드: 스켈레톤 2장 (그리드는 즉시 렌더 — 캘린더는 데이터 없이도 의미가 있다)
- fetch 실패 + 데이터 0: `EmptyState variant="error"` + 재시도. **'다가오는 모임' 섹션도 함께 숨긴다** — 안 그러면 빈 카드("잡힌 모임이 아직 없어요")가 실패를 '모임 없음'으로 위장한다(W1-7)
- 시간표 미등록: "시간표를 불러오면 수업도 함께 보여요" 힌트 행 → `/schedule/everytime`
- 빈 날: "이 날은 일정이 없어요" + 추가 CTA

## 6. 불가침 (무접촉 확인됨)

- `src/components/TimeGrid/**` — [D12](../../DECISIONS.md#d12--60fps-시간-그리드-구현-spec) worklet diff **0**
- Gate #1·#2 로깅 경로 무접촉 · 🔒 Phase 3 코드 0 · `CalendarDatePicker` 동작 변경 0

## 7. 검증

- Jest **1345 pass / 1 skip** (신규 ~146) · tsc 0 · eslint 0 errors · design-guard clean
- 신규 테스트 커버: RRULE 경계(UNTIL·expires·start_at·복수 BYDAY·미지원 FREQ) · UTC→KST 날짜 경계 · 마커 파생 · 시트 검증/중복 탭/삭제 확인 · 홈 15케이스
- **미완**: 에뮬레이터 시각 검증. 앱 재설치로 세션이 지워졌고 홈은 로그인 뒤에만 보인다 — 카카오 자격증명이 필요. 실기 확인 시 라이트/다크 렌더 + 수동 일정 추가→수정→삭제 라운드트립 + 수업이 마커에 안 찍히는지 확인 필요.
