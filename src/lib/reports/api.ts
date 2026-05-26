// S07-report — reports INSERT supabase wrapper (D32 베타 DB-only).
// RLS (0002:373-379): reports_insert_self는 auth.uid() = reporter_id 검증.
// 자기신고는 CHECK constraint (0001:401) + 사전 throw로 이중 차단.

import { supabase } from '@/lib/supabase/client';
import { validateReportInput } from './validation';

export interface SubmitReportInput {
  reporterId: string;
  targetUserId: string;
  reason: string;
  detail?: string;
}

export interface SubmittedReport {
  id: string;
  created_at: string;
}

export async function submitReport(input: SubmitReportInput): Promise<SubmittedReport> {
  if (input.reporterId === input.targetUserId) {
    throw new Error('자기 자신은 신고할 수 없어요.');
  }

  const validation = validateReportInput({
    targetUserId: input.targetUserId,
    reason: input.reason,
    detail: input.detail,
  });
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { input: validInput } = validation;

  const { data, error } = await supabase
    .from('reports')
    .insert({
      reporter_id: input.reporterId,
      target_id: validInput.targetUserId,
      reason: validInput.reason,
      detail: validInput.detail.length > 0 ? validInput.detail : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error('신고를 접수하지 못했어요. 잠시 후 다시 시도해주세요.');
  }

  return data as SubmittedReport;
}
