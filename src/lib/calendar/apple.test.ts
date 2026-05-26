// AppleCalendarProvider 단위 테스트.
// expo-calendar API는 DI(AppleCalendarApi)로 모킹.
//
// 커버리지:
//   순수 함수
//     1. buildAppleEvent — CalendarEventPayload → expo-calendar event spec (Asia/Seoul timeZone)
//     2. pickWritableCalendar — default → fallback writable → null
//   AppleCalendarProvider
//     3. isAuthorized — granted=true / denied/undetermined=false
//     4. requestPermission — granted no-throw / denied throw unauthorized / undetermined throw unauthorized
//     5. insertEvent — permission granted + writable default → createEventAsync 호출 / permission denied →
//                       unauthorized (createEventAsync 미호출) / default null·readonly + fallback writable →
//                       fallback calendar id로 호출 / 쓸 수 있는 calendar 0개 → unknown / createEventAsync throw → unknown

import {
  type AppleCalendarApi,
  type AppleCalendarDeps,
  type AppleCalendarHandle,
  AppleCalendarProvider,
  type AppleCalendarPermissionStatus,
  buildAppleEvent,
  pickWritableCalendar,
} from './apple';
import { type CalendarEventPayload } from './google';

// ---------------------------------------------------------------------------
// 순수 함수
// ---------------------------------------------------------------------------

describe('buildAppleEvent', () => {
  const payload: CalendarEventPayload = {
    title: '동아리 회식',
    startUtcIso: '2026-05-26T11:00:00.000Z', // KST 20:00
    endUtcIso: '2026-05-26T13:00:00.000Z', // KST 22:00
    descriptionKo: '[된다] 2026년 5월 26일 (화) 20:00 ~ 22:00 KST',
    locationName: '안암 본관',
  };

  it('기본: title/startDate/endDate/notes/location/timeZone 모두 매핑 + Asia/Seoul', () => {
    const event = buildAppleEvent(payload);
    expect(event.title).toBe('동아리 회식');
    expect(event.startDate).toBe('2026-05-26T11:00:00.000Z');
    expect(event.endDate).toBe('2026-05-26T13:00:00.000Z');
    expect(event.notes).toBe('[된다] 2026년 5월 26일 (화) 20:00 ~ 22:00 KST');
    expect(event.location).toBe('안암 본관');
    expect(event.timeZone).toBe('Asia/Seoul');
  });

  it('locationName null → location 키 생략 (expo-calendar 빈 문자열 회피)', () => {
    const event = buildAppleEvent({ ...payload, locationName: null });
    expect(event.location).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(event, 'location')).toBe(false);
  });

  it('빈 title → throw', () => {
    expect(() => buildAppleEvent({ ...payload, title: '' })).toThrow(/title/i);
    expect(() => buildAppleEvent({ ...payload, title: '   ' })).toThrow(/title/i);
  });
});

describe('pickWritableCalendar', () => {
  function makeCal(id: string, allowsModifications: boolean, title = id): AppleCalendarHandle {
    return {
      id,
      title,
      source: { name: 'iCloud' },
      allowsModifications,
    };
  }

  it('default cal allowsModifications=true → 그것 반환', () => {
    const def = makeCal('default-1', true);
    const all = [makeCal('a', false), makeCal('b', true)];
    expect(pickWritableCalendar(def, all)).toBe(def);
  });

  it('default cal allowsModifications=false → all 첫 writable 반환', () => {
    const def = makeCal('default-1', false);
    const writable = makeCal('w', true);
    const all = [makeCal('a', false), writable, makeCal('c', true)];
    expect(pickWritableCalendar(def, all)).toBe(writable);
  });

  it('default null → all 첫 writable', () => {
    const writable = makeCal('w', true);
    const all = [makeCal('a', false), writable];
    expect(pickWritableCalendar(null, all)).toBe(writable);
  });

  it('모두 read-only → null (호출자가 unknown 에러로 매핑)', () => {
    const def = makeCal('default-1', false);
    const all = [makeCal('a', false), makeCal('b', false)];
    expect(pickWritableCalendar(def, all)).toBeNull();
    expect(pickWritableCalendar(null, all)).toBeNull();
    expect(pickWritableCalendar(null, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AppleCalendarProvider — DI 헬퍼
// ---------------------------------------------------------------------------

function makeApi(overrides: Partial<AppleCalendarApi> = {}): AppleCalendarApi {
  return {
    getCalendarPermissionsAsync: jest.fn().mockResolvedValue({
      status: 'granted' as AppleCalendarPermissionStatus,
    }),
    requestCalendarPermissionsAsync: jest.fn().mockResolvedValue({
      status: 'granted' as AppleCalendarPermissionStatus,
    }),
    getDefaultCalendarAsync: jest.fn().mockResolvedValue({
      id: 'default-cal',
      title: '기본 캘린더',
      source: { name: 'iCloud' },
      allowsModifications: true,
    } satisfies AppleCalendarHandle),
    getCalendarsAsync: jest.fn().mockResolvedValue([]),
    createEventAsync: jest.fn().mockResolvedValue('apple-event-xyz'),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AppleCalendarDeps> = {}): AppleCalendarDeps {
  return {
    api: makeApi(),
    ...overrides,
  };
}

const EVENT_PAYLOAD: CalendarEventPayload = {
  title: '동아리 회식',
  startUtcIso: '2026-05-26T11:00:00.000Z',
  endUtcIso: '2026-05-26T13:00:00.000Z',
  descriptionKo: '[된다] 2026년 5월 26일 (화) 20:00 ~ 22:00 KST',
  locationName: '안암 본관',
};

// ---------------------------------------------------------------------------
// isAuthorized
// ---------------------------------------------------------------------------

describe('AppleCalendarProvider.isAuthorized', () => {
  it('status=granted → true', async () => {
    const provider = new AppleCalendarProvider(makeDeps());
    expect(await provider.isAuthorized()).toBe(true);
  });

  it('status=denied → false', async () => {
    const provider = new AppleCalendarProvider(
      makeDeps({
        api: makeApi({
          getCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
        }),
      }),
    );
    expect(await provider.isAuthorized()).toBe(false);
  });

  it('status=undetermined → false (사용자가 아직 응답 안 함)', async () => {
    const provider = new AppleCalendarProvider(
      makeDeps({
        api: makeApi({
          getCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
        }),
      }),
    );
    expect(await provider.isAuthorized()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requestPermission
// ---------------------------------------------------------------------------

describe('AppleCalendarProvider.requestPermission', () => {
  it('granted → no throw', async () => {
    const provider = new AppleCalendarProvider(makeDeps());
    await expect(provider.requestPermission()).resolves.toBeUndefined();
  });

  it('denied → CalendarProviderError({kind:unauthorized})', async () => {
    const provider = new AppleCalendarProvider(
      makeDeps({
        api: makeApi({
          requestCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
        }),
      }),
    );
    await expect(provider.requestPermission()).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unauthorized' },
    });
  });

  it('undetermined (시스템 prompt 종료 안 됨) → CalendarProviderError({unauthorized})', async () => {
    const provider = new AppleCalendarProvider(
      makeDeps({
        api: makeApi({
          requestCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'undetermined' }),
        }),
      }),
    );
    await expect(provider.requestPermission()).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unauthorized' },
    });
  });
});

// ---------------------------------------------------------------------------
// insertEvent
// ---------------------------------------------------------------------------

describe('AppleCalendarProvider.insertEvent', () => {
  it('happy: permission granted + default writable → createEventAsync 호출', async () => {
    const api = makeApi();
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    const result = await provider.insertEvent(EVENT_PAYLOAD);

    expect(api.createEventAsync).toHaveBeenCalledTimes(1);
    const [calendarId, event] = (api.createEventAsync as jest.Mock).mock.calls[0];
    expect(calendarId).toBe('default-cal');
    expect(event.title).toBe('동아리 회식');
    expect(event.timeZone).toBe('Asia/Seoul');
    expect(event.location).toBe('안암 본관');
    expect(result).toEqual({ eventId: 'apple-event-xyz' });
  });

  it('permission denied → unauthorized (createEventAsync 미호출)', async () => {
    const api = makeApi({
      getCalendarPermissionsAsync: jest.fn().mockResolvedValue({ status: 'denied' }),
    });
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unauthorized' },
    });
    expect(api.createEventAsync).not.toHaveBeenCalled();
  });

  it('default cal readonly + fallback writable → fallback calendar id로 호출', async () => {
    const fallbackCal: AppleCalendarHandle = {
      id: 'fallback-writable',
      title: '쓰기 가능 캘린더',
      source: { name: 'iCloud' },
      allowsModifications: true,
    };
    const readonlyDefault: AppleCalendarHandle = {
      id: 'default-cal',
      title: '구독 캘린더',
      source: { name: 'iCloud' },
      allowsModifications: false,
    };
    const api = makeApi({
      getDefaultCalendarAsync: jest.fn().mockResolvedValue(readonlyDefault),
      getCalendarsAsync: jest.fn().mockResolvedValue([readonlyDefault, fallbackCal]),
    });
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    await provider.insertEvent(EVENT_PAYLOAD);

    const [calendarId] = (api.createEventAsync as jest.Mock).mock.calls[0];
    expect(calendarId).toBe('fallback-writable');
    expect(api.getCalendarsAsync).toHaveBeenCalled();
  });

  it('default null + getCalendarsAsync 결과에서 첫 writable → 그 id 사용', async () => {
    const writable: AppleCalendarHandle = {
      id: 'first-writable',
      title: 'iCloud',
      source: { name: 'iCloud' },
      allowsModifications: true,
    };
    const api = makeApi({
      getDefaultCalendarAsync: jest.fn().mockResolvedValue(null),
      getCalendarsAsync: jest.fn().mockResolvedValue([writable]),
    });
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    await provider.insertEvent(EVENT_PAYLOAD);

    const [calendarId] = (api.createEventAsync as jest.Mock).mock.calls[0];
    expect(calendarId).toBe('first-writable');
  });

  it('쓸 수 있는 calendar 0개 → unknown 에러', async () => {
    const readonly: AppleCalendarHandle = {
      id: 'ro',
      title: '구독',
      source: { name: 'iCloud' },
      allowsModifications: false,
    };
    const api = makeApi({
      getDefaultCalendarAsync: jest.fn().mockResolvedValue(readonly),
      getCalendarsAsync: jest.fn().mockResolvedValue([readonly]),
    });
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unknown' },
    });
    expect(api.createEventAsync).not.toHaveBeenCalled();
  });

  it('createEventAsync throw → unknown 에러로 wrap', async () => {
    const api = makeApi({
      createEventAsync: jest.fn().mockRejectedValue(new Error('CalendarStore write failed')),
    });
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: {
        kind: 'unknown',
        message: expect.stringContaining('CalendarStore write failed'),
      },
    });
  });

  it('createEventAsync 빈 문자열 응답 → unknown 에러 (방어적)', async () => {
    const api = makeApi({
      createEventAsync: jest.fn().mockResolvedValue(''),
    });
    const provider = new AppleCalendarProvider(makeDeps({ api }));

    await expect(provider.insertEvent(EVENT_PAYLOAD)).rejects.toMatchObject({
      name: 'CalendarProviderError',
      detail: { kind: 'unknown' },
    });
  });
});
