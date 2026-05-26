import { validateConfirmGroupInput } from './validation';

const VALID_GROUP_ID = '11111111-2222-3333-4444-555555555555';
const VALID_PLACE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('validateConfirmGroupInput', () => {
  it('정상 입력 → valid: true', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 540,
      endMinute: 600,
      confirmedPlaceId: VALID_PLACE_ID,
    });
    expect(result.valid).toBe(true);
  });

  it('confirmedPlaceId null도 허용', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 540,
      endMinute: 600,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(true);
  });

  it('UUID 아닌 groupId → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: 'not-uuid',
      dayIndex: 0,
      startMinute: 540,
      endMinute: 600,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/모임 ID/);
  });

  it('dayIndex 음수 → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: -1,
      startMinute: 540,
      endMinute: 600,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/날짜/);
  });

  it('D14 위반 — 13분 단위 startMinute → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 543,
      endMinute: 600,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/15분/);
  });

  it('start_minute < 540 (09:00 이전) → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 480, // 08:00
      endMinute: 540,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/09:00/);
  });

  it('end_minute > 1440 → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 1425,
      endMinute: 1455,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/24:00/);
  });

  it('start ≥ end → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 720,
      endMinute: 600,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/종료/);
  });

  it('start == end → 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 600,
      endMinute: 600,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(false);
  });

  it('confirmedPlaceId가 UUID 아니면 한국어 에러', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 540,
      endMinute: 600,
      confirmedPlaceId: 'not-uuid',
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/장소/);
  });

  it('end_minute = 1440 (24:00) 정확히 허용', () => {
    const result = validateConfirmGroupInput({
      groupId: VALID_GROUP_ID,
      dayIndex: 0,
      startMinute: 1425,
      endMinute: 1440,
      confirmedPlaceId: null,
    });
    expect(result.valid).toBe(true);
  });
});
