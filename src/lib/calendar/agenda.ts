// S25 — 홈 캘린더가 그리는 것들을 한 모델로 합치는 순수 로직.
//
// 입력: 내 모임(fetchMyGroups) + 개인 일정 행(fetchActiveSchedules) + 그 전개 결과(expandSchedules)
// 출력: 날짜별 CalendarItem 목록 + 월 그리드 마커.
//
// 마커 규칙: 수업(everytime)은 마커에서 뺀다. 매주 반복이라 점을 찍으면 달 전체가 균일하게
// 칠해져 정보량이 0이 된다 — 수업은 선택일 목록에서만 보인다.
//
// D13: UTC→KST 변환은 전부 luxon Asia/Seoul. bare Date 금지.
import { DateTime } from 'luxon';

import type { MyGroupSummary } from '@/lib/groups/list';
import type { ScheduleRow } from '@/lib/schedules/queries';

import type { ScheduleOccurrence } from './recurrence';

const ZONE = 'Asia/Seoul';

export type CalendarItemKind = 'group-confirmed' | 'group-voting' | 'class' | 'personal';

export interface CalendarItem {
  /** 리스트 key — 같은 모임이 여러 후보일에 나오므로 날짜까지 포함 */
  key: string;
  kind: CalendarItemKind;
  title: string;
  /** KST yyyy-MM-dd */
  dateIso: string;
  /** KST 자정 기준 분. null = 시간 미정(투표 중) */
  startMinute: number | null;
  endMinute: number | null;
  /** 장소명 등 보조 정보 */
  subtitle: string | null;
  groupId: string | null;
  scheduleId: string | null;
}

export interface DayMarker {
  confirmed: boolean;
  voting: boolean;
  personal: boolean;
  /** 마커 대상(수업 제외) 건수 */
  total: number;
}

export interface BuildCalendarItemsInput {
  groups: MyGroupSummary[];
  schedules: ScheduleRow[];
  occurrences: ScheduleOccurrence[];
}

const KO_WEEKDAY = ['월', '화', '수', '목', '금', '토', '일']; // luxon weekday 1..7

/** 'yyyy-MM-dd' → '7월 18일 (토)'. 깨진 입력은 원문 유지. */
export function formatKstDayLabel(dateIso: string): string {
  const dt = DateTime.fromISO(dateIso, { zone: ZONE });
  if (!dt.isValid) return dateIso;
  return `${dt.month}월 ${dt.day}일 (${KO_WEEKDAY[dt.weekday - 1] ?? ''})`;
}

/** 분(KST 자정 기준) → 'HH:MM'. 1440은 24:00으로 유지(D14 슬롯 표기 관례). */
export function formatKstMinute(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface KstPoint {
  dateIso: string;
  minute: number;
}

function toKstPoint(utcIso: string): KstPoint | null {
  const dt = DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(ZONE);
  const dateIso = dt.isValid ? dt.toISODate() : null;
  if (dateIso === null) return null;
  return { dateIso, minute: dt.hour * 60 + dt.minute };
}

/** 확정 모임의 종료 분 — 같은 날이면 그대로, 자정을 넘기면 1440 clamp. */
function confirmedEndMinute(startIso: string, endIso: string | null): number | null {
  if (endIso === null) return null;
  const start = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(ZONE);
  const end = DateTime.fromISO(endIso, { zone: 'utc' }).setZone(ZONE);
  if (!start.isValid || !end.isValid) return null;
  const startMinute = start.hour * 60 + start.minute;
  const durationMinutes = Math.max(1, Math.round(end.diff(start, 'minutes').minutes));
  return Math.min(1440, startMinute + durationMinutes);
}

export function buildCalendarItems(input: BuildCalendarItemsInput): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const group of input.groups) {
    const confirmedPoint =
      group.confirmedStartAt === null ? null : toKstPoint(group.confirmedStartAt);

    if (confirmedPoint !== null && group.confirmedStartAt !== null) {
      items.push({
        key: `group:${group.id}`,
        kind: 'group-confirmed',
        title: group.name,
        dateIso: confirmedPoint.dateIso,
        startMinute: confirmedPoint.minute,
        endMinute: confirmedEndMinute(group.confirmedStartAt, group.confirmedEndAt),
        subtitle: group.placeName,
        groupId: group.id,
        scheduleId: null,
      });
      continue;
    }

    // 시간 미확정 — 후보 날짜마다 '투표 중' 항목
    for (const dateIso of group.dates) {
      items.push({
        key: `group:${group.id}:${dateIso}`,
        kind: 'group-voting',
        title: group.name,
        dateIso,
        startMinute: null,
        endMinute: null,
        subtitle: null,
        groupId: group.id,
        scheduleId: null,
      });
    }
  }

  const metaById = new Map(input.schedules.map((row) => [row.id, row]));
  for (const occurrence of input.occurrences) {
    const meta = metaById.get(occurrence.scheduleId);
    if (meta === undefined) continue; // 메타 없는 전개 결과는 표시할 수 없다
    items.push({
      key: `schedule:${occurrence.scheduleId}:${occurrence.dateIso}`,
      kind: meta.source === 'everytime' ? 'class' : 'personal',
      title: meta.title,
      dateIso: occurrence.dateIso,
      startMinute: occurrence.startMinute,
      endMinute: occurrence.endMinute,
      subtitle: null,
      groupId: null,
      scheduleId: occurrence.scheduleId,
    });
  }

  return items;
}

/** 날짜별로 묶고 각 날짜 안에서 시간 미정 → 시작 시각 순으로 정렬. */
export function groupByDate(items: CalendarItem[]): Record<string, CalendarItem[]> {
  const byDate: Record<string, CalendarItem[]> = {};
  for (const item of items) {
    (byDate[item.dateIso] ??= []).push(item);
  }
  for (const list of Object.values(byDate)) {
    list.sort((a, b) => {
      if (a.startMinute === null && b.startMinute === null) return 0;
      if (a.startMinute === null) return -1;
      if (b.startMinute === null) return 1;
      return a.startMinute - b.startMinute;
    });
  }
  return byDate;
}

/** 월 그리드 점 — 수업은 제외. 마커 대상이 없는 날은 키 자체가 없다. */
export function monthMarkers(byDate: Record<string, CalendarItem[]>): Record<string, DayMarker> {
  const markers: Record<string, DayMarker> = {};
  for (const [dateIso, list] of Object.entries(byDate)) {
    const marker: DayMarker = { confirmed: false, voting: false, personal: false, total: 0 };
    for (const item of list) {
      if (item.kind === 'class') continue;
      if (item.kind === 'group-confirmed') marker.confirmed = true;
      if (item.kind === 'group-voting') marker.voting = true;
      if (item.kind === 'personal') marker.personal = true;
      marker.total += 1;
    }
    if (marker.total > 0) markers[dateIso] = marker;
  }
  return markers;
}

/**
 * 홈 하단 '다가오는 모임' — 오늘(KST) 이후 기준 이른 순 limit개.
 * 날짜가 전부 과거인 모임은 제외, 날짜가 아예 없는 모임은 맨 뒤에 남긴다.
 */
export function upcomingGroups(
  groups: MyGroupSummary[],
  todayIso: string,
  limit = 3,
): MyGroupSummary[] {
  const scored: { group: MyGroupSummary; sortKey: string }[] = [];

  for (const group of groups) {
    const confirmedDate =
      group.confirmedStartAt === null ? null : toKstPoint(group.confirmedStartAt)?.dateIso;
    if (confirmedDate !== null && confirmedDate !== undefined) {
      if (confirmedDate >= todayIso) scored.push({ group, sortKey: confirmedDate });
      continue;
    }
    const future = group.dates.filter((d) => d >= todayIso).sort();
    if (future.length > 0) {
      scored.push({ group, sortKey: future[0] as string });
      continue;
    }
    // 후보 날짜가 하나도 없는 모임(날짜 미정)만 뒤로 — 전부 과거면 제외
    if (group.dates.length === 0) scored.push({ group, sortKey: '9999-12-31' });
  }

  scored.sort((a, b) => (a.sortKey === b.sortKey ? 0 : a.sortKey < b.sortKey ? -1 : 1));
  return scored.slice(0, limit).map((s) => s.group);
}
