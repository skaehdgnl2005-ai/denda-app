// W2-9 — 홈 스탯 순수 함수. '이번 달 모임' = 이번 달(KST)에 후보 날짜가
// 하나라도 있는 내 모임 수. now는 주입해 결정적 테스트(D13 KST, bare Date 금지).
import { DateTime } from 'luxon';

const ZONE = 'Asia/Seoul';

/**
 * 후보 날짜(dates[])가 nowKstIso와 같은 KST 연도+월에 하나라도 있는 모임의 수.
 * 잘못된 now/날짜는 방어적으로 0/무시 처리한다.
 */
export function countGroupsThisMonthKst(groups: { dates: string[] }[], nowKstIso: string): number {
  const now = DateTime.fromISO(nowKstIso, { zone: ZONE });
  if (!now.isValid) return 0;
  const { year, month } = now;

  return groups.reduce((count, group) => {
    const hasThisMonth = group.dates.some((iso) => {
      const dt = DateTime.fromISO(iso, { zone: ZONE });
      return dt.isValid && dt.year === year && dt.month === month;
    });
    return count + (hasThisMonth ? 1 : 0);
  }, 0);
}
