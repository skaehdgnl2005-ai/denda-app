// S25 — 주간 RRULE 전개 순수 로직 테스트.
// now() 미사용 — 창(window)을 인자로 받아 결정적.
import { expandSchedules, parseWeeklyRule } from './recurrence';
import type { ScheduleRow } from '@/lib/schedules/queries';

function row(over: Partial<ScheduleRow>): ScheduleRow {
  return {
    id: 's1',
    user_id: 'u1',
    source: 'everytime',
    title: '선형대수',
    // 2026-07-06(월) 10:00~11:30 KST
    start_at: '2026-07-06T01:00:00.000Z',
    end_at: '2026-07-06T02:30:00.000Z',
    recurrence_rule: null,
    expires_at: null,
    external_id: null,
    ...over,
  };
}

describe('parseWeeklyRule', () => {
  test('FREQ=WEEKLY;BYDAY=MO;UNTIL=… 파싱', () => {
    const parsed = parseWeeklyRule('FREQ=WEEKLY;BYDAY=MO;UNTIL=20260822T145959Z');
    expect(parsed?.weekdays).toEqual([1]);
    expect(parsed?.untilUtcIso).toBe('2026-08-22T14:59:59.000Z');
  });

  test('BYDAY 복수 요일 지원 (무음 드롭 금지)', () => {
    expect(parseWeeklyRule('FREQ=WEEKLY;BYDAY=MO,WE,FR')?.weekdays).toEqual([1, 3, 5]);
  });

  test('UNTIL 없으면 null', () => {
    expect(parseWeeklyRule('FREQ=WEEKLY;BYDAY=SU')?.untilUtcIso).toBeNull();
  });

  test('WEEKLY 아닌 FREQ / 깨진 규칙은 null', () => {
    expect(parseWeeklyRule('FREQ=MONTHLY;BYDAY=MO')).toBeNull();
    expect(parseWeeklyRule('FREQ=WEEKLY;BYDAY=XX')).toBeNull();
    expect(parseWeeklyRule('쓰레기')).toBeNull();
  });
});

describe('expandSchedules — 단발 일정 (recurrence_rule = null)', () => {
  test('창 안이면 1건, 시작 분/종료 분은 KST 기준', () => {
    const out = expandSchedules([row({})], '2026-07-01', '2026-07-31');
    expect(out).toEqual([
      { scheduleId: 's1', dateIso: '2026-07-06', startMinute: 600, endMinute: 690 },
    ]);
  });

  test('창 밖이면 0건', () => {
    expect(expandSchedules([row({})], '2026-08-01', '2026-08-31')).toEqual([]);
    expect(expandSchedules([row({})], '2026-06-01', '2026-06-30')).toEqual([]);
  });

  test('UTC→KST 날짜 경계 — 15:30Z는 다음 날 00:30 KST', () => {
    const out = expandSchedules(
      [
        row({
          id: 's-late',
          source: 'manual',
          start_at: '2026-07-18T15:30:00.000Z',
          end_at: '2026-07-18T16:30:00.000Z',
        }),
      ],
      '2026-07-01',
      '2026-07-31',
    );
    expect(out).toEqual([
      { scheduleId: 's-late', dateIso: '2026-07-19', startMinute: 30, endMinute: 90 },
    ]);
  });

  test('자정을 넘는 종료는 1440으로 clamp', () => {
    // 23:00 ~ 다음 날 01:00 KST
    const out = expandSchedules(
      [
        row({
          id: 's-night',
          source: 'manual',
          start_at: '2026-07-18T14:00:00.000Z',
          end_at: '2026-07-18T16:00:00.000Z',
        }),
      ],
      '2026-07-01',
      '2026-07-31',
    );
    expect(out[0]).toEqual({
      scheduleId: 's-night',
      dateIso: '2026-07-18',
      startMinute: 1380,
      endMinute: 1440,
    });
  });
});

describe('expandSchedules — 주간 반복', () => {
  const weekly = row({ recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO;UNTIL=20260720T145959Z' });

  test('창 안의 해당 요일마다 1건씩, UNTIL 이후는 중단', () => {
    const out = expandSchedules([weekly], '2026-07-01', '2026-07-31');
    expect(out.map((o) => o.dateIso)).toEqual(['2026-07-06', '2026-07-13', '2026-07-20']);
    out.forEach((o) => {
      expect(o.startMinute).toBe(600);
      expect(o.endMinute).toBe(690);
    });
  });

  test('첫 occurrence(start_at) 이전 날짜는 만들지 않는다', () => {
    const out = expandSchedules([weekly], '2026-06-01', '2026-07-13');
    expect(out.map((o) => o.dateIso)).toEqual(['2026-07-06', '2026-07-13']);
  });

  test('창이 반복 중간부터 시작해도 해당 구간만 전개', () => {
    const out = expandSchedules([weekly], '2026-07-14', '2026-07-31');
    expect(out.map((o) => o.dateIso)).toEqual(['2026-07-20']);
  });

  test('expires_at(학기 종료) 이후 occurrence 제외', () => {
    const expiring = row({
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO',
      // 2026-07-14 00:00 KST 만료 → 7/13까지만
      expires_at: '2026-07-13T15:00:00.000Z',
    });
    const out = expandSchedules([expiring], '2026-07-01', '2026-07-31');
    expect(out.map((o) => o.dateIso)).toEqual(['2026-07-06', '2026-07-13']);
  });

  test('BYDAY 복수 요일은 요일별로 전개', () => {
    const multi = row({
      id: 's-multi',
      // UNTIL = 2026-07-15 23:59:59 KST
      recurrence_rule: 'FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260715T145959Z',
    });
    const out = expandSchedules([multi], '2026-07-01', '2026-07-31');
    expect(out.map((o) => o.dateIso)).toEqual([
      '2026-07-06',
      '2026-07-08',
      '2026-07-13',
      '2026-07-15',
    ]);
  });

  test('미지원 FREQ는 첫 occurrence만 남긴다 (무음 전량 드롭 금지)', () => {
    const monthly = row({ id: 's-m', recurrence_rule: 'FREQ=MONTHLY;BYMONTHDAY=6' });
    const out = expandSchedules([monthly], '2026-07-01', '2026-07-31');
    expect(out).toEqual([
      { scheduleId: 's-m', dateIso: '2026-07-06', startMinute: 600, endMinute: 690 },
    ]);
  });
});

describe('expandSchedules — 정렬/방어', () => {
  test('날짜 → 시작 시각 순으로 정렬', () => {
    const late = row({
      id: 'late',
      source: 'manual',
      start_at: '2026-07-06T10:00:00.000Z', // 19:00 KST
      end_at: '2026-07-06T11:00:00.000Z',
    });
    const early = row({ id: 'early' }); // 10:00 KST
    const out = expandSchedules([late, early], '2026-07-01', '2026-07-31');
    expect(out.map((o) => o.scheduleId)).toEqual(['early', 'late']);
  });

  test('깨진 타임스탬프·역전 창은 빈 배열', () => {
    expect(expandSchedules([row({ start_at: '쓰레기' })], '2026-07-01', '2026-07-31')).toEqual([]);
    expect(expandSchedules([row({})], '2026-07-31', '2026-07-01')).toEqual([]);
  });
});
