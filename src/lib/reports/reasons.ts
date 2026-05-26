// Schema enum report_reason 정합 (0001_initial.sql:29):
//   'spam' | 'harassment' | 'inappropriate' | 'fake_profile' | 'other'

export const REPORT_REASONS = [
  { key: 'spam', label: '스팸 및 광고' },
  { key: 'harassment', label: '욕설 및 괴롭힘' },
  { key: 'inappropriate', label: '부적절한 닉네임/프로필' },
  { key: 'fake_profile', label: '사칭 및 가짜 프로필' },
  { key: 'other', label: '기타' },
] as const;

export type ReportReasonKey = (typeof REPORT_REASONS)[number]['key'];

export const REPORT_REASON_KEYS: readonly ReportReasonKey[] = REPORT_REASONS.map((r) => r.key);

const REASON_LABEL_MAP: Record<ReportReasonKey, string> = REPORT_REASONS.reduce(
  (acc, r) => ({ ...acc, [r.key]: r.label }),
  {} as Record<ReportReasonKey, string>,
);

export function getReasonLabel(key: ReportReasonKey): string {
  return REASON_LABEL_MAP[key];
}

export function isValidReasonKey(key: string): key is ReportReasonKey {
  return (REPORT_REASON_KEYS as readonly string[]).includes(key);
}
