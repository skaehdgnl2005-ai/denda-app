// S25 — 수동 개인 일정 CRUD (schedules.source = 'manual').
//
// 테이블·enum·RLS(0002 schedules_*_self 4종)는 기존 자산 — 마이그레이션 없음.
// RLS가 본인 행만 허용하므로 클라이언트 필터는 불필요하되, deny가 조용한 0 rows로
// 오는 것은 무음 성공이 되므로 setConfirmedPlace와 같은 방식으로 surface한다.
//
// D13: 입력은 KST(날짜 + 자정 기준 분), 저장은 UTC TIMESTAMPTZ. bare Date 금지.
// 반복 일정은 이번 범위 밖 — recurrence_rule은 항상 null.
import { DateTime } from 'luxon';

import { supabase } from '@/lib/supabase/client';

const ZONE = 'Asia/Seoul';
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TITLE_MAX = 40;

const CREATE_FAIL = '일정을 저장하지 못했어요. 잠시 후 다시 시도해주세요.';
const UPDATE_FAIL = '일정을 수정하지 못했어요. 잠시 후 다시 시도해주세요.';
const DELETE_FAIL = '일정을 삭제하지 못했어요. 잠시 후 다시 시도해주세요.';

export interface PersonalScheduleInput {
  title: string;
  /** KST yyyy-MM-dd */
  dateIso: string;
  /** KST 자정 기준 분 */
  startMinute: number;
  endMinute: number;
}

/** KST 날짜 + 분 구간 → UTC ISO 쌍. 1440(자정)은 다음 날 00:00으로 자연 롤오버. */
export function toUtcRange(
  dateIso: string,
  startMinute: number,
  endMinute: number,
): { start_at: string; end_at: string } {
  const base = DateTime.fromISO(dateIso, { zone: ZONE }).startOf('day');
  const start = base.plus({ minutes: startMinute }).toUTC().toISO();
  const end = base.plus({ minutes: endMinute }).toUTC().toISO();
  if (start === null || end === null) {
    throw new Error('날짜를 다시 선택해주세요.');
  }
  return { start_at: start, end_at: end };
}

/** 통과하면 null, 아니면 사용자에게 그대로 보여줄 한국어 메시지. */
export function validatePersonalSchedule(input: PersonalScheduleInput): string | null {
  const title = input.title.trim();
  if (title.length === 0) return '일정 이름을 입력해주세요.';
  if (title.length > TITLE_MAX) return `일정 이름은 ${TITLE_MAX}자까지 쓸 수 있어요.`;
  if (!ISO_DATE_RE.test(input.dateIso)) return '날짜를 다시 선택해주세요.';
  if (!DateTime.fromISO(input.dateIso, { zone: ZONE }).isValid) return '날짜를 다시 선택해주세요.';
  if (input.endMinute <= input.startMinute) return '종료 시간은 시작 시간보다 늦어야 해요.';
  return null;
}

function assertValid(input: PersonalScheduleInput): void {
  const message = validatePersonalSchedule(input);
  if (message !== null) throw new Error(message);
}

export async function createPersonalSchedule(
  userId: string,
  input: PersonalScheduleInput,
): Promise<{ id: string }> {
  assertValid(input);
  const { start_at, end_at } = toUtcRange(input.dateIso, input.startMinute, input.endMinute);

  const { data, error } = await supabase
    .from('schedules')
    .insert({
      user_id: userId,
      source: 'manual',
      title: input.title.trim(),
      start_at,
      end_at,
      recurrence_rule: null,
      expires_at: null,
    })
    .select('id')
    .single();

  const row = data as { id: string } | null;
  if (error || row === null) {
    throw new Error(CREATE_FAIL);
  }
  return { id: row.id };
}

export async function updatePersonalSchedule(
  scheduleId: string,
  input: PersonalScheduleInput,
): Promise<void> {
  assertValid(input);
  const { start_at, end_at } = toUtcRange(input.dateIso, input.startMinute, input.endMinute);

  const { data, error } = await supabase
    .from('schedules')
    .update({ title: input.title.trim(), start_at, end_at })
    .eq('id', scheduleId)
    .select('id');

  if (error || ((data ?? []) as { id: string }[]).length === 0) {
    throw new Error(UPDATE_FAIL);
  }
}

export async function deletePersonalSchedule(scheduleId: string): Promise<void> {
  const { data, error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId)
    .select('id');

  if (error || ((data ?? []) as { id: string }[]).length === 0) {
    throw new Error(DELETE_FAIL);
  }
}
