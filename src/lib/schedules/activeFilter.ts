// S03b — 학기 종료 자동 만료 필터.
// schedules.expires_at < NOW 인 경우 UI에서 숨김.
// D13: KST → UTC ISO 비교는 호출자가 luxon으로 산출 (이 모듈은 pure).

export interface ScheduleLike {
  expires_at?: string | null;
}

export function isScheduleActive(s: ScheduleLike, nowUtcIso: string): boolean {
  const exp = s.expires_at;
  if (exp === null || exp === undefined) return true;
  return exp > nowUtcIso;
}

// PostgREST `.or(filter)` 인자용 문자열
export function buildActiveScheduleFilter(nowUtcIso: string): string {
  return `expires_at.is.null,expires_at.gt.${nowUtcIso}`;
}
