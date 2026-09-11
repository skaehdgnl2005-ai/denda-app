// 월간 캘린더 그리드 순수 로직 (KST, luxon). now() 미사용 → 결정적 테스트 가능.
// 모임 후보 날짜 선택(CalendarDatePicker)이 소비. 일요일 시작 7열 매트릭스.
// bare Date 금지 (D13) — DateTime(zone: 'Asia/Seoul')만 사용.
import { DateTime } from 'luxon';

const ZONE = 'Asia/Seoul';

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface DayCell {
  /** yyyy-MM-dd (KST). 빈 셀 없음 — 인접 달 날짜도 실제 ISO를 가진다. */
  iso: string;
  /** 1~31 */
  day: number;
  /** 앵커 달에 속하는지 (인접 달 날짜는 false) */
  inMonth: boolean;
  /** 0=일 … 6=토 */
  weekday: number;
}

/**
 * anchorIso가 속한 달을 일요일 시작 주 단위 매트릭스로 변환.
 * 첫/마지막 주의 인접 달 날짜는 inMonth=false로 포함 (그리드 정렬 유지).
 */
export function buildMonthMatrix(anchorIso: string): DayCell[][] {
  const anchor = DateTime.fromISO(anchorIso, { zone: ZONE });
  if (!anchor.isValid) return [];

  const first = anchor.startOf('month');
  // luxon weekday: 1=월 … 7=일. 일요일 시작 그리드의 앞 패딩 = weekday % 7 (일→0, 월→1 … 토→6).
  const leadPad = first.weekday % 7;
  const gridStart = first.minus({ days: leadPad });
  const daysInMonth = anchor.daysInMonth ?? 30;
  const weekCount = Math.ceil((leadPad + daysInMonth) / 7);

  const weeks: DayCell[][] = [];
  for (let w = 0; w < weekCount; w += 1) {
    const week: DayCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = gridStart.plus({ days: w * 7 + i });
      week.push({
        iso: d.toISODate() ?? '',
        day: d.day,
        inMonth: d.month === anchor.month && d.year === anchor.year,
        weekday: d.weekday % 7,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** "2026년 6월" — 헤더 타이틀. */
export function monthTitle(anchorIso: string): string {
  const d = DateTime.fromISO(anchorIso, { zone: ZONE });
  if (!d.isValid) return anchorIso;
  return `${d.year}년 ${d.month}월`;
}

/** delta 달만큼 이동한 달의 1일 ISO(yyyy-MM-01). 경계 비교/네비게이션용. */
export function shiftMonth(anchorIso: string, delta: number): string {
  const d = DateTime.fromISO(anchorIso, { zone: ZONE });
  if (!d.isValid) return anchorIso;
  return d.plus({ months: delta }).startOf('month').toISODate() ?? anchorIso;
}
