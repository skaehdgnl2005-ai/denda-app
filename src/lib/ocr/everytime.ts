// S03 — 에브리타임 OCR 클라이언트 wrapper.
// Gemini Vision은 절대 클라이언트에서 직접 호출 금지 (CLAUDE.md 규칙 7).
// 항상 Edge Function `ocr_everytime` 경유.

import { supabase } from '@/lib/supabase/client';

export type Day = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface OcrCourse {
  name: string;
  day: Day;
  start: string;
  end: string;
  room?: string;
}

export interface PreviewResult {
  courses: OcrCourse[];
}

export interface ConfirmResult {
  inserted: number;
}

async function invokeOcr<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('ocr_everytime', { body });
  if (error) {
    throw new Error(`ocr_everytime: ${error.message}`);
  }
  if (!data) {
    throw new Error('ocr_everytime: empty response');
  }
  return data;
}

export async function previewEverytimeOcr(params: {
  imageBase64: string;
  mimeType?: string;
}): Promise<PreviewResult> {
  return invokeOcr<PreviewResult>({
    action: 'preview',
    image: params.imageBase64,
    mimeType: params.mimeType ?? 'image/png',
  });
}

export async function confirmEverytimeOcr(params: {
  courses: OcrCourse[];
  semesterStart: string;
  semesterEnd: string;
  replaceExisting?: boolean;
}): Promise<ConfirmResult> {
  return invokeOcr<ConfirmResult>({
    action: 'confirm',
    courses: params.courses,
    semesterStart: params.semesterStart,
    semesterEnd: params.semesterEnd,
    replaceExisting: params.replaceExisting ?? false,
  });
}
