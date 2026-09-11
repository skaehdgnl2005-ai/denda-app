// W2-5 요일 헤더 포맷 단위 테스트 (luxon KST 강제).
import { formatDayHeader, KO_WEEKDAY } from '@/lib/datetime/dayHeader';

describe('formatDayHeader (W2-5)', () => {
  test('2026-07-08 (수요일) → { weekday: 수, date: 7/8 }', () => {
    expect(formatDayHeader('2026-07-08')).toEqual({ weekday: '수', date: '7/8' });
  });

  test('2026-07-11 (토요일) → { weekday: 토, date: 7/11 }', () => {
    expect(formatDayHeader('2026-07-11')).toEqual({ weekday: '토', date: '7/11' });
  });

  test('앞자리 0 없는 M/D 포맷 (2026-01-05 → 1/5)', () => {
    expect(formatDayHeader('2026-01-05')).toEqual({ weekday: '월', date: '1/5' });
  });

  test('잘못된 입력은 빈 요일 + 원본 반환 (그리드 깨짐 방지)', () => {
    expect(formatDayHeader('not-a-date')).toEqual({ weekday: '', date: 'not-a-date' });
  });

  test('KO_WEEKDAY는 월~일 7개', () => {
    expect(KO_WEEKDAY).toHaveLength(7);
    expect(KO_WEEKDAY[0]).toBe('월');
    expect(KO_WEEKDAY[6]).toBe('일');
  });
});
