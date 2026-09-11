// 시간 그리드 요일 헤더 포맷 (W2-5). luxon Asia/Seoul(KST 강제 D13) — bare Date 금지.
// KO_WEEKDAY는 ConfirmSlotSheet·ConfirmedTimeCard에 중복돼 있던 상수의 공용 단일 출처.
import { DateTime } from 'luxon';

const KST_ZONE = 'Asia/Seoul';

/** luxon weekday 1..7 (월~일) 매핑. */
export const KO_WEEKDAY = ['월', '화', '수', '목', '금', '토', '일'] as const;

export interface DayHeader {
  /** 요일 (예: '수') */
  weekday: string;
  /** 날짜 (예: '7/8') */
  date: string;
}

/**
 * ISO 날짜(yyyy-MM-dd, KST 기준) → 요일 + M/D 날짜. 잘못된 입력은 빈 요일 + 원본을 반환해
 * 그리드 헤더가 깨지지 않게 한다.
 */
export function formatDayHeader(iso: string): DayHeader {
  const dt = DateTime.fromISO(iso, { zone: KST_ZONE });
  if (!dt.isValid) {
    return { weekday: '', date: iso };
  }
  return { weekday: KO_WEEKDAY[dt.weekday - 1] ?? '', date: `${dt.month}/${dt.day}` };
}
