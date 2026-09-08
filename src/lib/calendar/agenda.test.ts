// S25 — 모임 + 개인 일정 병합 순수 로직 테스트. now() 미사용(오늘 날짜는 주입).
import {
  buildCalendarItems,
  formatKstDayLabel,
  formatKstMinute,
  groupByDate,
  monthMarkers,
  upcomingGroups,
} from './agenda';
import type { MyGroupSummary } from '@/lib/groups/list';
import type { ScheduleRow } from '@/lib/schedules/queries';

function group(over: Partial<MyGroupSummary>): MyGroupSummary {
  return {
    id: 'g1',
    name: '동아리 회식',
    dates: [],
    confirmedAt: null,
    confirmedStartAt: null,
    confirmedEndAt: null,
    placeName: null,
    ...over,
  };
}

function schedule(over: Partial<ScheduleRow>): ScheduleRow {
  return {
    id: 's1',
    user_id: 'u1',
    source: 'everytime',
    title: '선형대수',
    start_at: '2026-07-06T01:00:00.000Z',
    end_at: '2026-07-06T02:30:00.000Z',
    recurrence_rule: null,
    expires_at: null,
    external_id: null,
    ...over,
  };
}

describe('formatKstMinute', () => {
  test('분을 HH:MM으로, 1440은 24:00 유지', () => {
    expect(formatKstMinute(0)).toBe('00:00');
    expect(formatKstMinute(600)).toBe('10:00');
    expect(formatKstMinute(1155)).toBe('19:15');
    expect(formatKstMinute(1440)).toBe('24:00');
  });
});

describe('formatKstDayLabel', () => {
  test('한국어 날짜 + 요일', () => {
    expect(formatKstDayLabel('2026-07-18')).toBe('7월 18일 (토)');
    expect(formatKstDayLabel('2026-07-06')).toBe('7월 6일 (월)');
  });

  test('깨진 입력은 원문 유지', () => {
    expect(formatKstDayLabel('쓰레기')).toBe('쓰레기');
  });
});

describe('buildCalendarItems — 확정 모임', () => {
  test('confirmed_start_at(UTC)을 KST 날짜·분으로 변환하고 장소를 부제로', () => {
    const items = buildCalendarItems({
      groups: [
        group({
          confirmedAt: '2026-07-01T00:00:00Z',
          confirmedStartAt: '2026-07-18T10:00:00.000Z', // 19:00 KST
          confirmedEndAt: '2026-07-18T13:00:00.000Z', // 22:00 KST
          placeName: '강남 이자카야',
          dates: ['2026-07-18'],
        }),
      ],
      schedules: [],
      occurrences: [],
    });
    expect(items).toEqual([
      {
        key: 'group:g1',
        kind: 'group-confirmed',
        title: '동아리 회식',
        dateIso: '2026-07-18',
        startMinute: 1140,
        endMinute: 1320,
        subtitle: '강남 이자카야',
        groupId: 'g1',
        scheduleId: null,
      },
    ]);
  });

  test('UTC→KST 날짜 경계 — 15:30Z 확정은 다음 날 00:30 KST', () => {
    const items = buildCalendarItems({
      groups: [
        group({
          confirmedAt: '2026-07-01T00:00:00Z',
          confirmedStartAt: '2026-07-18T15:30:00.000Z',
          dates: ['2026-07-18'],
        }),
      ],
      schedules: [],
      occurrences: [],
    });
    expect(items[0]?.dateIso).toBe('2026-07-19');
    expect(items[0]?.startMinute).toBe(30);
  });

  test('확정 시각이 없는(장소만 확정 전) 모임은 후보 날짜로 되돌아간다', () => {
    const items = buildCalendarItems({
      groups: [group({ confirmedAt: '2026-07-01T00:00:00Z', dates: ['2026-07-18', '2026-07-19'] })],
      schedules: [],
      occurrences: [],
    });
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.kind === 'group-voting')).toBe(true);
  });
});

describe('buildCalendarItems — 투표 중 모임', () => {
  test('후보 날짜마다 시간 미정 항목 생성', () => {
    const items = buildCalendarItems({
      groups: [group({ dates: ['2026-07-18', '2026-07-20'] })],
      schedules: [],
      occurrences: [],
    });
    expect(items.map((i) => [i.key, i.dateIso, i.startMinute])).toEqual([
      ['group:g1:2026-07-18', '2026-07-18', null],
      ['group:g1:2026-07-20', '2026-07-20', null],
    ]);
    expect(items[0]?.kind).toBe('group-voting');
    expect(items[0]?.groupId).toBe('g1');
  });
});

describe('buildCalendarItems — 개인 일정', () => {
  const occurrences = [
    { scheduleId: 's1', dateIso: '2026-07-06', startMinute: 600, endMinute: 690 },
    { scheduleId: 's2', dateIso: '2026-07-06', startMinute: 1140, endMinute: 1260 },
  ];

  test('everytime은 수업, 그 외 source는 내 일정으로 분류', () => {
    const items = buildCalendarItems({
      groups: [],
      schedules: [schedule({}), schedule({ id: 's2', source: 'manual', title: '치과' })],
      occurrences,
    });
    expect(items.map((i) => [i.kind, i.title, i.scheduleId])).toEqual([
      ['class', '선형대수', 's1'],
      ['personal', '치과', 's2'],
    ]);
    expect(items[0]?.key).toBe('schedule:s1:2026-07-06');
    expect(items[0]?.endMinute).toBe(690);
  });

  test('메타(schedules 행)가 없는 occurrence는 버린다', () => {
    const items = buildCalendarItems({ groups: [], schedules: [], occurrences });
    expect(items).toEqual([]);
  });
});

describe('groupByDate', () => {
  test('날짜별로 묶고 — 시간 미정 먼저, 이후 시작 시각 순', () => {
    const items = buildCalendarItems({
      groups: [
        group({ id: 'gv', name: '투표중', dates: ['2026-07-06'] }),
        group({
          id: 'gc',
          name: '확정',
          confirmedAt: '2026-07-01T00:00:00Z',
          confirmedStartAt: '2026-07-06T10:00:00.000Z', // 19:00 KST
          dates: ['2026-07-06'],
        }),
      ],
      schedules: [schedule({})],
      occurrences: [{ scheduleId: 's1', dateIso: '2026-07-06', startMinute: 600, endMinute: 690 }],
    });
    const byDate = groupByDate(items);
    expect(Object.keys(byDate)).toEqual(['2026-07-06']);
    expect(byDate['2026-07-06']?.map((i) => i.title)).toEqual(['투표중', '선형대수', '확정']);
  });
});

describe('monthMarkers', () => {
  test('확정·투표·개인 플래그와 개수 (수업은 마커에서 제외)', () => {
    const items = buildCalendarItems({
      groups: [
        group({
          id: 'gc',
          confirmedAt: '2026-07-01T00:00:00Z',
          confirmedStartAt: '2026-07-06T10:00:00.000Z',
          dates: ['2026-07-06'],
        }),
        group({ id: 'gv', dates: ['2026-07-07'] }),
      ],
      schedules: [schedule({}), schedule({ id: 's2', source: 'manual', title: '치과' })],
      occurrences: [
        { scheduleId: 's1', dateIso: '2026-07-08', startMinute: 600, endMinute: 690 },
        { scheduleId: 's2', dateIso: '2026-07-08', startMinute: 900, endMinute: 960 },
      ],
    });
    const markers = monthMarkers(groupByDate(items));
    expect(markers['2026-07-06']).toEqual({
      confirmed: true,
      voting: false,
      personal: false,
      total: 1,
    });
    expect(markers['2026-07-07']).toEqual({
      confirmed: false,
      voting: true,
      personal: false,
      total: 1,
    });
    // 7/8은 수업 1 + 내 일정 1 → 수업은 세지 않는다 (매주 반복이라 달 전체가 균일해짐)
    expect(markers['2026-07-08']).toEqual({
      confirmed: false,
      voting: false,
      personal: true,
      total: 1,
    });
  });

  test('수업만 있는 날은 마커 없음', () => {
    const items = buildCalendarItems({
      groups: [],
      schedules: [schedule({})],
      occurrences: [{ scheduleId: 's1', dateIso: '2026-07-06', startMinute: 600, endMinute: 690 }],
    });
    expect(monthMarkers(groupByDate(items))['2026-07-06']).toBeUndefined();
  });
});

describe('upcomingGroups', () => {
  const today = '2026-07-18';

  test('오늘 이후만, 이른 순으로, limit까지', () => {
    const result = upcomingGroups(
      [
        group({ id: 'past', dates: ['2026-07-01'] }),
        group({ id: 'far', dates: ['2026-07-25'] }),
        group({
          id: 'soon',
          confirmedAt: '2026-07-01T00:00:00Z',
          confirmedStartAt: '2026-07-19T10:00:00.000Z',
          dates: ['2026-07-19'],
        }),
        group({ id: 'later', dates: ['2026-07-30'] }),
      ],
      today,
      3,
    );
    expect(result.map((g) => g.id)).toEqual(['soon', 'far', 'later']);
  });

  test('오늘 날짜는 포함', () => {
    const result = upcomingGroups([group({ id: 'today', dates: [today] })], today, 3);
    expect(result.map((g) => g.id)).toEqual(['today']);
  });

  test('후보 날짜가 전부 과거인 모임은 제외', () => {
    expect(upcomingGroups([group({ id: 'stale', dates: ['2026-07-01'] })], today, 3)).toEqual([]);
  });

  test('날짜가 아예 없는 모임은 맨 뒤에 남긴다', () => {
    const result = upcomingGroups(
      [group({ id: 'undated', dates: [] }), group({ id: 'dated', dates: ['2026-07-19'] })],
      today,
      3,
    );
    expect(result.map((g) => g.id)).toEqual(['dated', 'undated']);
  });
});
