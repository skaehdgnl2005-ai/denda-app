import { isValidReasonKey, type ReportReasonKey } from './reasons';

export const REPORT_DETAIL_MAX_LENGTH = 500;

export interface ReportInput {
  targetUserId: string;
  reason: string;
  detail?: string;
}

export interface ValidReportInput {
  targetUserId: string;
  reason: ReportReasonKey;
  detail: string;
}

export type ValidationResult =
  | { valid: true; input: ValidReportInput }
  | { valid: false; error: string };

export function validateReportInput(input: ReportInput): ValidationResult {
  const targetUserId = input.targetUserId.trim();
  if (!targetUserId) {
    return { valid: false, error: '신고 대상이 필요해요.' };
  }

  if (!isValidReasonKey(input.reason)) {
    return { valid: false, error: '올바른 신고 사유를 선택해주세요.' };
  }

  const detail = input.detail ?? '';
  if (detail.length > REPORT_DETAIL_MAX_LENGTH) {
    return {
      valid: false,
      error: `상세 내용은 ${REPORT_DETAIL_MAX_LENGTH}자 이내로 입력해주세요.`,
    };
  }

  return {
    valid: true,
    input: { targetUserId, reason: input.reason, detail },
  };
}
