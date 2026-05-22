// KST (Asia/Seoul) 시간 유틸 — D13 강제
// 모든 시간 표시·입력은 이 모듈 통과. luxon 사용 (bare 'new Date()' 금지).

import { DateTime } from 'luxon';

const KST_ZONE = 'Asia/Seoul';

export function nowKst(): DateTime {
  return DateTime.now().setZone(KST_ZONE);
}

export function toKstIso(utcIso: string): string {
  return DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(KST_ZONE).toISO() ?? '';
}

export function fromKstIso(kstIso: string): DateTime {
  return DateTime.fromISO(kstIso, { setZone: true }).toUTC();
}

export function kstDateString(utcIso: string): string {
  return DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(KST_ZONE).toISODate() ?? '';
}

export function kstMinutesOfDay(utcIso: string): number {
  const kst = DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(KST_ZONE);
  return kst.hour * 60 + kst.minute;
}

export function formatKstTime(utcIso: string, fmt = 'yyyy-MM-dd HH:mm'): string {
  return DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(KST_ZONE).toFormat(fmt);
}
