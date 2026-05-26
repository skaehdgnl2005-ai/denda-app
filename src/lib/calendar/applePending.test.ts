// applePending — calendar_push_apple_pending 클라이언트 polling 처리 unit tests.
//
// 검증 대상:
//   parsePendingRow — DB row → ApplePendingRow (payload JSONB 검증)
//   processApplePendingPushes — SELECT pending → 각 row processOneRow → summary
//   processOneRow — apple.insertEvent + supabase UPDATE completed_at

import {
  type ApplePendingRow,
  type ApplePendingDeps,
  parsePendingRow,
  processApplePendingPushes,
  processOneRow,
} from './applePending';
import { CalendarProviderError, type CalendarEventPayload } from './google';
import type { AppleCalendarProvider } from './apple';

// ---------------------------------------------------------------------------
// parsePendingRow
// ---------------------------------------------------------------------------

const validPayload: CalendarEventPayload = {
  title: '안암 저녁 모임',
  startUtcIso: '2026-05-30T11:00:00+00:00',
  endUtcIso: '2026-05-30T13:00:00+00:00',
  descriptionKo: '[된다] ...',
  locationName: null,
};

const validRowRaw = {
  id: 'row-1',
  group_id: 'group-1',
  user_id: 'user-1',
  payload: validPayload,
  created_at: '2026-05-26T11:00:00+00:00',
  completed_at: null,
};

describe('parsePendingRow', () => {
  it('정상 row → ApplePendingRow', () => {
    const row = parsePendingRow(validRowRaw);
    expect(row).not.toBeNull();
    expect(row?.id).toBe('row-1');
    expect(row?.groupId).toBe('group-1');
    expect(row?.userId).toBe('user-1');
    expect(row?.payload.title).toBe('안암 저녁 모임');
  });

  it('payload 누락 → null', () => {
    expect(parsePendingRow({ ...validRowRaw, payload: null })).toBeNull();
  });

  it('payload.title 누락 → null', () => {
    expect(
      parsePendingRow({
        ...validRowRaw,
        payload: { ...validPayload, title: undefined as unknown as string },
      }),
    ).toBeNull();
  });

  it('id 누락 → null', () => {
    expect(parsePendingRow({ ...validRowRaw, id: null })).toBeNull();
  });

  it('group_id 누락 → null', () => {
    expect(parsePendingRow({ ...validRowRaw, group_id: undefined })).toBeNull();
  });

  it('locationName이 빈 string이면 그대로 (null과 별개 — 사용자 입력 신뢰)', () => {
    const row = parsePendingRow({
      ...validRowRaw,
      payload: { ...validPayload, locationName: '' },
    });
    expect(row?.payload.locationName).toBe('');
  });
});

// ---------------------------------------------------------------------------
// processOneRow
// ---------------------------------------------------------------------------

interface MockUpdateChain {
  update: jest.Mock;
  eq1: jest.Mock;
}

function makeSupabaseMock(opts: {
  selectRows?: unknown[];
  selectError?: { message: string } | null;
  updateError?: { message: string } | null;
}) {
  const updateCalls: { id: string; completed_at: string | null }[] = [];

  const updateMock = jest.fn().mockImplementation((payload: { completed_at: string }) => {
    return {
      eq: jest.fn().mockImplementation((_col: string, id: string) => {
        updateCalls.push({ id, completed_at: payload.completed_at });
        return Promise.resolve({ data: null, error: opts.updateError ?? null });
      }),
    };
  });

  const selectMock = jest.fn().mockReturnValue({
    is: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({
        data: opts.selectRows ?? [],
        error: opts.selectError ?? null,
      }),
    }),
  });

  const from = jest.fn().mockImplementation((_table: string) => ({
    select: selectMock,
    update: updateMock,
  }));

  return {
    client: { from } as unknown as ApplePendingDeps['supabase'],
    updateCalls,
    selectMock,
    updateMock,
  };
}

function makeAppleProviderMock(opts: {
  isAuthorized?: boolean;
  insertEventImpl?: (payload: CalendarEventPayload) => Promise<{ eventId: string }>;
}): AppleCalendarProvider {
  const isAuthorized = opts.isAuthorized ?? true;
  return {
    providerName: 'apple_ios',
    isAuthorized: jest.fn().mockResolvedValue(isAuthorized),
    requestPermission: jest.fn().mockResolvedValue(undefined),
    insertEvent: jest
      .fn()
      .mockImplementation(
        opts.insertEventImpl ??
          (() => Promise.resolve({ eventId: 'evt-x' })),
      ),
  } as unknown as AppleCalendarProvider;
}

describe('processOneRow', () => {
  const baseRow: ApplePendingRow = {
    id: 'row-1',
    groupId: 'group-1',
    userId: 'user-1',
    payload: validPayload,
    createdAt: '2026-05-26T11:00:00+00:00',
  };

  it('insertEvent 성공 → completed_at UPDATE 호출', async () => {
    const { client, updateCalls } = makeSupabaseMock({});
    const apple = makeAppleProviderMock({});
    const now = () => '2026-05-26T12:00:00+00:00';

    const result = await processOneRow({ supabase: client, apple, now }, baseRow);

    expect(result.ok).toBe(true);
    expect(apple.insertEvent).toHaveBeenCalledWith(validPayload);
    expect(updateCalls).toEqual([
      { id: 'row-1', completed_at: '2026-05-26T12:00:00+00:00' },
    ]);
  });

  it('insertEvent throw CalendarProviderError → fail, UPDATE 미호출', async () => {
    const { client, updateCalls } = makeSupabaseMock({});
    const apple = makeAppleProviderMock({
      insertEventImpl: () =>
        Promise.reject(new CalendarProviderError({ kind: 'unauthorized' })),
    });
    const now = () => '2026-05-26T12:00:00+00:00';

    const result = await processOneRow({ supabase: client, apple, now }, baseRow);

    expect(result).toEqual({ ok: false, reason: 'unauthorized' });
    expect(updateCalls).toEqual([]);
  });

  it('insertEvent throw 일반 Error → fail reason="unknown"', async () => {
    const { client, updateCalls } = makeSupabaseMock({});
    const apple = makeAppleProviderMock({
      insertEventImpl: () => Promise.reject(new Error('boom')),
    });
    const now = () => '2026-05-26T12:00:00+00:00';

    const result = await processOneRow({ supabase: client, apple, now }, baseRow);

    expect(result).toEqual({ ok: false, reason: 'unknown' });
    expect(updateCalls).toEqual([]);
  });

  it('UPDATE error → fail로 분류 (DB 갱신 실패)', async () => {
    const { client } = makeSupabaseMock({ updateError: { message: 'db oops' } });
    const apple = makeAppleProviderMock({});
    const now = () => '2026-05-26T12:00:00+00:00';

    const result = await processOneRow({ supabase: client, apple, now }, baseRow);

    expect(result).toEqual({ ok: false, reason: 'update_failed' });
  });
});

// ---------------------------------------------------------------------------
// processApplePendingPushes
// ---------------------------------------------------------------------------

describe('processApplePendingPushes', () => {
  it('빈 pending → {completed:0, failed:0, skippedUnauthorized:false}', async () => {
    const { client } = makeSupabaseMock({ selectRows: [] });
    const apple = makeAppleProviderMock({});
    const now = () => '2026-05-26T12:00:00+00:00';

    const summary = await processApplePendingPushes({
      supabase: client,
      apple,
      now,
    });

    expect(summary).toEqual({
      completed: 0,
      failed: 0,
      skippedUnauthorized: false,
    });
  });

  it('apple.isAuthorized=false → 전 row skip, skippedUnauthorized=true', async () => {
    const { client, updateCalls } = makeSupabaseMock({
      selectRows: [validRowRaw, { ...validRowRaw, id: 'row-2' }],
    });
    const apple = makeAppleProviderMock({ isAuthorized: false });
    const now = () => '2026-05-26T12:00:00+00:00';

    const summary = await processApplePendingPushes({
      supabase: client,
      apple,
      now,
    });

    expect(summary).toEqual({
      completed: 0,
      failed: 0,
      skippedUnauthorized: true,
    });
    expect(apple.insertEvent).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([]);
  });

  it('2 rows 모두 성공 → completed=2', async () => {
    const { client, updateCalls } = makeSupabaseMock({
      selectRows: [validRowRaw, { ...validRowRaw, id: 'row-2', group_id: 'group-2' }],
    });
    const apple = makeAppleProviderMock({});
    const now = () => '2026-05-26T12:00:00+00:00';

    const summary = await processApplePendingPushes({
      supabase: client,
      apple,
      now,
    });

    expect(summary.completed).toBe(2);
    expect(summary.failed).toBe(0);
    expect(updateCalls.map((c) => c.id).sort()).toEqual(['row-1', 'row-2']);
  });

  it('2 rows 중 1 성공 + 1 실패', async () => {
    const { client, updateCalls } = makeSupabaseMock({
      selectRows: [validRowRaw, { ...validRowRaw, id: 'row-2' }],
    });
    let callCount = 0;
    const apple = makeAppleProviderMock({
      insertEventImpl: () => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ eventId: 'evt' });
        return Promise.reject(new CalendarProviderError({ kind: 'unknown', message: 'x' }));
      },
    });
    const now = () => '2026-05-26T12:00:00+00:00';

    const summary = await processApplePendingPushes({
      supabase: client,
      apple,
      now,
    });

    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(updateCalls).toEqual([
      { id: 'row-1', completed_at: '2026-05-26T12:00:00+00:00' },
    ]);
  });

  it('malformed row → failed로 분류 + insertEvent 미호출', async () => {
    const { client, updateCalls } = makeSupabaseMock({
      selectRows: [{ ...validRowRaw, payload: null }],
    });
    const apple = makeAppleProviderMock({});
    const now = () => '2026-05-26T12:00:00+00:00';

    const summary = await processApplePendingPushes({
      supabase: client,
      apple,
      now,
    });

    expect(summary).toEqual({
      completed: 0,
      failed: 1,
      skippedUnauthorized: false,
    });
    expect(apple.insertEvent).not.toHaveBeenCalled();
    expect(updateCalls).toEqual([]);
  });

  it('SELECT error → throw', async () => {
    const { client } = makeSupabaseMock({ selectError: { message: 'db read fail' } });
    const apple = makeAppleProviderMock({});
    const now = () => '2026-05-26T12:00:00+00:00';

    await expect(
      processApplePendingPushes({ supabase: client, apple, now }),
    ).rejects.toThrow(/db read fail/);
  });
});
