// calendar_queue.ts — S06 calendar push background queue 순수 함수 (D19·D20)
//
// 책임:
//   1. isCalendarPushPending — pg_cron worker가 queue selection 시 사용할 조건
//   2. nextRetryState — retry max 3 정책 (D20)
//   3. buildCalendarEventPayload — groups row → 외부 캘린더 event spec (D13 KST 표기)
//
// 모두 순수 함수. DB 접근·외부 API 호출 X (worker Edge Function이 본 함수 호출).
// 본 sub-task(S06-queue-foundation)는 데이터 변환·정책 결정만 정의. 실제 Google/Apple
// API 호출은 다음 sub-task(S06-worker-integration)에서 calendar_push_worker가 사용.

import { DateTime } from 'npm:luxon@3.4.4';

/**
 * D20 retry 최대 횟수. worker가 3회 실패 시 stop → groups.partial_fail_list에 누적.
 */
export const CALENDAR_PUSH_MAX_RETRY = 3;

/**
 * groups.partial_fail_list JSONB entry의 channel 라벨. notify_f5는 'f5_push',
 * calendar_push_worker는 'calendar_push'. JSONB schema는 두 channel이 공유 (notify_f5/index.ts PartialFailEntry).
 */
export const CALENDAR_PUSH_CHANNEL = 'calendar_push';

const KST_ZONE = 'Asia/Seoul';

/**
 * luxon weekday(1=월 ~ 7=일) → 한국어 1글자 요일. ICU locale 의존 회피.
 */
const KO_WEEKDAY: Record<number, string> = {
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
  7: '일',
};

/**
 * worker가 SELECT한 groups row 중 calendar push 추적에 필요한 부분.
 * (id·name·confirmed_*·calendar_*·partial_fail_list — host_id/멤버는 worker가 별도 fetch)
 */
export interface CalendarQueueGroup {
  id: string;
  name: string;
  confirmed_at: string | null;
  confirmed_start_at: string | null;
  confirmed_end_at: string | null;
  calendar_pushed_at: string | null;
  calendar_retry_count: number;
  partial_fail_list?: PartialFailEntry[];
}

/**
 * buildCalendarEventPayload 입력 — confirmed_* 가 NOT NULL인 상태만 받음.
 * (worker가 isCalendarPushPending 통과 row만 전달)
 */
export interface CalendarEventGroupInput {
  id: string;
  name: string;
  confirmed_start_at: string;
  confirmed_end_at: string;
  placeName?: string | null;
}

/**
 * 외부 캘린더(Google · Apple)에 push할 event spec. provider-neutral.
 * Google Calendar API: title→summary, descriptionKo→description, locationName→location.
 * expo-calendar: title→title, descriptionKo→notes, locationName→location.
 */
export interface CalendarEventPayload {
  title: string;
  startUtcIso: string;
  endUtcIso: string;
  descriptionKo: string;
  locationName: string | null;
}

export interface NextRetryState {
  nextCount: number;
  shouldStop: boolean;
}

/**
 * groups.partial_fail_list JSONB entry — notify_f5와 동일 shape (cross-channel JSONB lastWriteWins).
 * channel은 push 출처를 식별 (운영 통계 + 호스트 알림 분기).
 */
export interface PartialFailEntry {
  user_id: string;
  reason: string;
  channel: string;
  occurred_at: string; // KST ISO
}

export interface MemberFailure {
  userId: string;
  reason: string;
}

export interface BuildCalendarPartialFailArgs {
  failures: MemberFailure[];
  occurredAtKstIso: string;
  channel?: string;
}

// ---------------------------------------------------------------------------
// Queue selection — D20
// ---------------------------------------------------------------------------

/**
 * pg_cron worker가 SELECT한 row가 push 대상인지 판정.
 *
 * 조건 (모두 만족):
 *   - confirmed_at IS NOT NULL (모임 확정됨)
 *   - calendar_pushed_at IS NULL (아직 push 안 됨)
 *   - calendar_retry_count < MAX (영구 fail 아님)
 *
 * partial index `groups_calendar_push_pending_idx`로 SQL level에서도 필터링되지만,
 * worker 코드 path에서 한 번 더 명시 검증해 race condition 안전성 ↑.
 */
export function isCalendarPushPending(group: CalendarQueueGroup): boolean {
  return (
    group.confirmed_at !== null &&
    group.calendar_pushed_at === null &&
    group.calendar_retry_count < CALENDAR_PUSH_MAX_RETRY
  );
}

// ---------------------------------------------------------------------------
// Retry policy — D20
// ---------------------------------------------------------------------------

/**
 * 1회 실패 후 다음 retry_count 계산.
 *
 *   0 → {1, false}  (1차 실패)
 *   1 → {2, false}  (2차 실패)
 *   2 → {3, true}   (3차 실패 = max 도달, stop)
 *   3 → {3, true}   (이미 max, idempotent — worker가 다시 호출해도 안전)
 *
 * `shouldStop=true`일 때 worker는 partial_fail_list 갱신만 하고 다음 retry 큐잉 X.
 */
export function nextRetryState(currentCount: number): NextRetryState {
  if (!Number.isInteger(currentCount) || currentCount < 0) {
    throw new Error(
      `calendar_retry_count는 0 이상 정수여야 합니다: ${currentCount}`,
    );
  }
  if (currentCount >= CALENDAR_PUSH_MAX_RETRY) {
    return { nextCount: CALENDAR_PUSH_MAX_RETRY, shouldStop: true };
  }
  const nextCount = currentCount + 1;
  return { nextCount, shouldStop: nextCount >= CALENDAR_PUSH_MAX_RETRY };
}

// ---------------------------------------------------------------------------
// Event payload builder — D13 KST 표기 + D19 단방향
// ---------------------------------------------------------------------------

/**
 * groups row → 외부 캘린더 event spec.
 *
 * - title: 모임명 그대로 (Google · Apple 둘 다 single-line summary로 사용)
 * - start·end: UTC ISO를 그대로 전달 (외부 API가 자체적으로 timezone 처리)
 * - descriptionKo: 한국어 본문 + KST 시간 표기 — 외부 캘린더에서 한국 사용자가 한눈에
 *   "한국 시간 기준 X시 ~ Y시"를 확인 가능. D13(KST 강제) 정합
 * - locationName: place 이름 (worker가 places JOIN해서 전달, 없으면 null)
 *
 * KST 24:00 (다음날 00:00) 표기 처리: 시간 그리드와 동일하게 "24:00"으로 표시.
 */
export function buildCalendarEventPayload(
  group: CalendarEventGroupInput,
): CalendarEventPayload {
  if (!group.name || group.name.trim().length === 0) {
    throw new Error('group.name이 필요합니다.');
  }

  const start = DateTime.fromISO(group.confirmed_start_at, { setZone: true });
  if (!start.isValid) {
    throw new Error(
      `confirmed_start_at parse 실패: ${group.confirmed_start_at}`,
    );
  }

  const end = DateTime.fromISO(group.confirmed_end_at, { setZone: true });
  if (!end.isValid) {
    throw new Error(`confirmed_end_at parse 실패: ${group.confirmed_end_at}`);
  }

  if (end <= start) {
    throw new Error('confirmed_end_at은 confirmed_start_at보다 늦어야 합니다.');
  }

  const startKst = start.setZone(KST_ZONE);
  const endKst = end.setZone(KST_ZONE);

  const dayName = KO_WEEKDAY[startKst.weekday] ?? '?';
  const dayLabel = `${startKst.year}년 ${startKst.month}월 ${startKst.day}일 (${dayName})`;
  const startLabel = startKst.toFormat('HH:mm');
  const endLabel = formatEndOfDayLabel(startKst, endKst);

  return {
    title: group.name,
    startUtcIso: group.confirmed_start_at,
    endUtcIso: group.confirmed_end_at,
    descriptionKo: `[된다] ${dayLabel} ${startLabel} ~ ${endLabel} KST`,
    locationName: group.placeName ?? null,
  };
}

/**
 * KST 자정 종료(다음날 00:00)는 시간 그리드와 동일하게 "24:00"으로 표기.
 * 그 외는 toFormat('HH:mm'). multi-day는 S04 spec상 미지원이므로 endKst.day가
 * startKst.day +1 인 경우만 24:00 케이스로 간주.
 */
function formatEndOfDayLabel(startKst: DateTime, endKst: DateTime): string {
  if (
    endKst.hour === 0 &&
    endKst.minute === 0 &&
    !endKst.hasSame(startKst, 'day')
  ) {
    return '24:00';
  }
  return endKst.toFormat('HH:mm');
}

// ---------------------------------------------------------------------------
// Partial fail JSONB helpers — D19 부분 실패 누적
// ---------------------------------------------------------------------------

/**
 * 멤버 실패 list → groups.partial_fail_list JSONB entry array.
 *
 * - notify_f5의 PartialFailEntry shape과 동일 (cross-channel lastWriteWins JSONB)
 * - failures가 빈 array면 빈 array 반환 (worker가 caller 측에서 length check 없이 호출 가능)
 * - channel default = 'calendar_push' (CALENDAR_PUSH_CHANNEL 상수)
 */
export function buildCalendarPartialFailEntries(
  args: BuildCalendarPartialFailArgs,
): PartialFailEntry[] {
  const channel = args.channel ?? CALENDAR_PUSH_CHANNEL;
  return args.failures.map((f) => ({
    user_id: f.userId,
    reason: f.reason,
    channel,
    occurred_at: args.occurredAtKstIso,
  }));
}

/**
 * groups.partial_fail_list 현재 JSONB array에 new entries를 append.
 * - immutable: 원본 currentList 변경 X (worker가 SELECT → append → UPDATE 패턴)
 * - 빈 + 빈 = 빈 (lastWriteWins JSONB 갱신은 UPDATE 호출 측에서 if(length>0) 가드 권장)
 */
export function appendPartialFailEntries(
  currentList: PartialFailEntry[],
  newEntries: PartialFailEntry[],
): PartialFailEntry[] {
  return [...currentList, ...newEntries];
}

// ---------------------------------------------------------------------------
// Queue selection 안전망 — worker가 SELECT한 rows를 isCalendarPushPending로 한 번 더 필터
// ---------------------------------------------------------------------------

/**
 * worker가 DB SELECT 결과를 받은 후 application level에서 한 번 더 isCalendarPushPending 적용.
 * SQL WHERE 절(partial index 활용)이 1차 필터링하지만, retry_count 변경·calendar_pushed_at SET이
 * 동시 발생할 수 있는 race window 안전망.
 *
 * 순서는 입력 그대로 보존 (worker가 deterministic 처리 순서를 보장하려는 경우 유용).
 */
export function selectPendingFromRows(
  rows: CalendarQueueGroup[],
): CalendarQueueGroup[] {
  return rows.filter(isCalendarPushPending);
}

// ---------------------------------------------------------------------------
// decideGroupPushOutcome — worker의 DB UPDATE 의사결정 (100% 순수)
// ---------------------------------------------------------------------------

/**
 * 한 멤버에 대한 push 결과. result='ok' 또는 실패 사유 포함.
 */
export type MemberPushOutcome =
  | { userId: string; result: 'ok' }
  | { userId: string; result: { reason: string } };

/**
 * worker가 멤버 iterate 후 groups row에 적용할 UPDATE 묶음.
 *   - shouldSetPushedAt: true → calendar_pushed_at SET (모든 멤버 성공)
 *   - shouldSetPushedAt: false → partial_fail_list append + calendar_retry_count UPDATE
 *   - shouldStop: retry max 도달 → 호스트 알림 trigger 후보 (다음 sub-task 책임)
 */
export interface GroupPushDecision {
  groupId: string;
  shouldSetPushedAt: boolean;
  newRetryCount: number;
  newPartialFailEntries: PartialFailEntry[];
  shouldStop: boolean;
}

export interface DecideGroupPushOutcomeArgs {
  group: CalendarQueueGroup;
  memberOutcomes: MemberPushOutcome[];
  occurredAtKstIso: string;
}

/**
 * 멤버 outcomes 모두 'ok' → calendar_pushed_at SET, retry_count·partial_fail 변경 X.
 * 1+ 멤버 실패 → retry_count++ + partial_fail_list append. retry_count==MAX 도달 시 shouldStop=true.
 *
 * 멤버 0명 모임은 outcomes도 빈 → 모두 'ok'로 해석 (shouldSetPushedAt=true).
 * 멤버 없는 모임이 큐에 진입한 케이스는 정상은 아니지만 큐 무한 누적 방지.
 */
export function decideGroupPushOutcome(
  args: DecideGroupPushOutcomeArgs,
): GroupPushDecision {
  const failures: MemberFailure[] = args.memberOutcomes
    .filter(
      (o): o is { userId: string; result: { reason: string } } =>
        typeof o.result === 'object' && o.result !== null && 'reason' in o.result,
    )
    .map((o) => ({ userId: o.userId, reason: o.result.reason }));

  if (failures.length === 0) {
    return {
      groupId: args.group.id,
      shouldSetPushedAt: true,
      newRetryCount: args.group.calendar_retry_count,
      newPartialFailEntries: [],
      shouldStop: false,
    };
  }

  const retry = nextRetryState(args.group.calendar_retry_count);
  return {
    groupId: args.group.id,
    shouldSetPushedAt: false,
    newRetryCount: retry.nextCount,
    newPartialFailEntries: buildCalendarPartialFailEntries({
      failures,
      occurredAtKstIso: args.occurredAtKstIso,
    }),
    shouldStop: retry.shouldStop,
  };
}
