// S04 — 모임 확정 입력 사전 검증 (클라이언트 측 즉시 피드백).
// 서버 group_confirm Edge Function이 최종 검증·DB CHECK가 강제 — 본 모듈은 UX 즉시성용.
//
// 규칙:
//   - groupId / confirmedPlaceId: UUID v4 형식
//   - dayIndex: 0 이상 정수
//   - startMinute / endMinute: 15분 단위 (D14), 540 ≤ start < 1440, start < end ≤ 1440

export interface ConfirmGroupInput {
  groupId: string;
  dayIndex: number;
  startMinute: number;
  endMinute: number;
  confirmedPlaceId: string | null;
}

export type ValidationResult =
  | { valid: true; input: ConfirmGroupInput }
  | { valid: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateConfirmGroupInput(input: ConfirmGroupInput): ValidationResult {
  if (!input.groupId || !UUID_RE.test(input.groupId)) {
    return { valid: false, error: '모임 ID가 올바르지 않아요.' };
  }
  if (!Number.isInteger(input.dayIndex) || input.dayIndex < 0) {
    return { valid: false, error: '날짜를 다시 선택해주세요.' };
  }
  if (
    !Number.isInteger(input.startMinute) ||
    !Number.isInteger(input.endMinute) ||
    input.startMinute % 15 !== 0 ||
    input.endMinute % 15 !== 0
  ) {
    return { valid: false, error: '시간은 15분 단위로 선택해야 해요.' };
  }
  if (input.startMinute < 540 || input.startMinute >= 1440) {
    return { valid: false, error: '시작 시간은 09:00 ~ 23:45 사이여야 해요.' };
  }
  if (input.endMinute <= input.startMinute || input.endMinute > 1440) {
    return { valid: false, error: '종료 시간은 시작 시간보다 늦고 24:00 이하여야 해요.' };
  }
  if (input.confirmedPlaceId !== null && !UUID_RE.test(input.confirmedPlaceId)) {
    return { valid: false, error: '장소 ID가 올바르지 않아요.' };
  }
  return { valid: true, input };
}
