import { logReservationClick } from './click_through';

import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';
const VALID_PLACE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const VALID_PARTNERSHIP_ID = '99999999-8888-7777-6666-555555555555';
const FIXED_EVENT_ID = '12345678-1234-1234-1234-123456789abc';

describe('logReservationClick', () => {
  const mockInvoke = supabase.functions.invoke as jest.Mock;

  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('정상 케이스: click_log Edge에 snake_case body 전달 + camelCase 응답 변환', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ok: true,
        event_id: FIXED_EVENT_ID,
        duplicated: false,
      },
      error: null,
    });

    const result = await logReservationClick(
      {
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
        partnershipId: VALID_PARTNERSHIP_ID,
        segmentLabel: 'P1',
      },
      { genEventId: () => FIXED_EVENT_ID },
    );

    expect(mockInvoke).toHaveBeenCalledWith('click_log', {
      body: {
        event_id: FIXED_EVENT_ID,
        group_id: VALID_GROUP_ID,
        place_id: VALID_PLACE_ID,
        partnership_id: VALID_PARTNERSHIP_ID,
        segment_label: 'P1',
      },
    });
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe(FIXED_EVENT_ID);
    expect(result.duplicated).toBe(false);
  });

  it('partnershipId 미명시 → body에 null 전달 (비제휴 식당)', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, event_id: FIXED_EVENT_ID, duplicated: false },
      error: null,
    });

    await logReservationClick(
      {
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
      },
      { genEventId: () => FIXED_EVENT_ID },
    );

    expect(mockInvoke).toHaveBeenCalledWith('click_log', {
      body: expect.objectContaining({
        partnership_id: null,
        segment_label: null,
      }),
    });
  });

  it('segmentLabel P2 + partnershipId null 명시', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, event_id: FIXED_EVENT_ID, duplicated: false },
      error: null,
    });

    await logReservationClick(
      {
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
        partnershipId: null,
        segmentLabel: 'P2',
      },
      { genEventId: () => FIXED_EVENT_ID },
    );

    expect(mockInvoke).toHaveBeenCalledWith('click_log', {
      body: expect.objectContaining({
        partnership_id: null,
        segment_label: 'P2',
      }),
    });
  });

  it('caller가 eventId 명시 → 그대로 사용 (재시도 idempotency)', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, event_id: FIXED_EVENT_ID, duplicated: true },
      error: null,
    });

    const genEventId = jest.fn();
    const result = await logReservationClick(
      {
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
        eventId: FIXED_EVENT_ID,
      },
      { genEventId },
    );

    expect(genEventId).not.toHaveBeenCalled();
    expect(result.eventId).toBe(FIXED_EVENT_ID);
    expect(result.duplicated).toBe(true);
  });

  it('eventId 미명시 → genEventId 호출 1회', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, event_id: FIXED_EVENT_ID, duplicated: false },
      error: null,
    });

    const genEventId = jest.fn(() => FIXED_EVENT_ID);
    await logReservationClick(
      {
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
      },
      { genEventId },
    );

    expect(genEventId).toHaveBeenCalledTimes(1);
  });

  it('Edge 401 응답 → "로그인 필요" 한국어 에러', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: '인증이 필요합니다.' },
    });

    await expect(
      logReservationClick(
        { groupId: VALID_GROUP_ID, placeId: VALID_PLACE_ID },
        { genEventId: () => FIXED_EVENT_ID },
      ),
    ).rejects.toThrow(/로그인/);
  });

  it('Edge 기타 에러 → 일반 한국어 메시지', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'database connection failed' },
    });

    await expect(
      logReservationClick(
        { groupId: VALID_GROUP_ID, placeId: VALID_PLACE_ID },
        { genEventId: () => FIXED_EVENT_ID },
      ),
    ).rejects.toThrow(/클릭을 기록하지 못했어요/);
  });

  it('Edge가 data null 반환 → 일반 한국어 에러', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(
      logReservationClick(
        { groupId: VALID_GROUP_ID, placeId: VALID_PLACE_ID },
        { genEventId: () => FIXED_EVENT_ID },
      ),
    ).rejects.toThrow(/클릭을 기록하지 못했어요/);
  });

  it('duplicated=true 응답 → result.duplicated=true (더블 탭 idempotent 성공)', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, event_id: FIXED_EVENT_ID, duplicated: true },
      error: null,
    });

    const result = await logReservationClick(
      {
        groupId: VALID_GROUP_ID,
        placeId: VALID_PLACE_ID,
        eventId: FIXED_EVENT_ID,
      },
      { genEventId: () => FIXED_EVENT_ID },
    );

    expect(result.ok).toBe(true);
    expect(result.duplicated).toBe(true);
  });

  it('segmentLabel 잘못된 값 사전 throw (Edge invoke 0)', async () => {
    await expect(
      logReservationClick(
        {
          groupId: VALID_GROUP_ID,
          placeId: VALID_PLACE_ID,
          // @ts-expect-error — 의도적 잘못된 타입
          segmentLabel: 'P3',
        },
        { genEventId: () => FIXED_EVENT_ID },
      ),
    ).rejects.toThrow(/segment_label/);

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('groupId가 UUID 아님 → 사전 throw (Edge invoke 0)', async () => {
    await expect(
      logReservationClick(
        { groupId: 'not-a-uuid', placeId: VALID_PLACE_ID },
        { genEventId: () => FIXED_EVENT_ID },
      ),
    ).rejects.toThrow(/group_id/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('placeId가 UUID 아님 → 사전 throw (Edge invoke 0)', async () => {
    await expect(
      logReservationClick(
        { groupId: VALID_GROUP_ID, placeId: 'invalid' },
        { genEventId: () => FIXED_EVENT_ID },
      ),
    ).rejects.toThrow(/place_id/);
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
