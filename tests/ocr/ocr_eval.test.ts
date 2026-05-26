// S03 — Ground truth OCR 정확도 회귀 (TEST_PLAN §3.4).
// 실제 Gemini API 호출이 필요하므로 OCR_EVAL_ENABLED=1 + GEMINI_API_KEY 둘 다 있을 때만 실행.
// PNG fixture가 없으면 모든 케이스 skip → 운영 task에서 채워질 때까지 회귀 OK.

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { diffAccuracy, type OcrCourseLike } from '@/lib/ocr/diffAccuracy';

const GROUND_TRUTH_DIR = join(__dirname, 'ground_truth');
const ACCURACY_THRESHOLD = 0.9;

interface ExpectedFile {
  _note?: string;
  semester?: { start: string; end: string };
  courses: OcrCourseLike[];
}

function listCases(): string[] {
  if (!existsSync(GROUND_TRUTH_DIR)) return [];
  return readdirSync(GROUND_TRUTH_DIR)
    .filter((f) => f.endsWith('.expected.json'))
    .map((f) => f.replace('.expected.json', ''))
    .filter((name) => existsSync(join(GROUND_TRUTH_DIR, `${name}.png`)));
}

const cases = listCases();
const evalEnabled = process.env.OCR_EVAL_ENABLED === '1' && !!process.env.GEMINI_API_KEY;

describe('OCR eval (ground truth)', () => {
  if (cases.length === 0) {
    it.skip('no PNG fixtures yet — see tests/ocr/README.md', () => {});
    return;
  }
  if (!evalEnabled) {
    it.skip('eval disabled — set OCR_EVAL_ENABLED=1 + GEMINI_API_KEY to run', () => {});
    return;
  }
  cases.forEach((name) => {
    it(`${name}: 정확도 ≥ ${ACCURACY_THRESHOLD}`, async () => {
      const expected: ExpectedFile = JSON.parse(
        readFileSync(join(GROUND_TRUTH_DIR, `${name}.expected.json`), 'utf-8'),
      );
      const imageBase64 = readFileSync(join(GROUND_TRUTH_DIR, `${name}.png`)).toString('base64');

      // Lazy import: eval 미실행 시 client/supabase import 불필요
      const { previewEverytimeOcr } = await import('@/lib/ocr/everytime');
      const result = await previewEverytimeOcr({ imageBase64, mimeType: 'image/png' });
      const diff = diffAccuracy(result.courses, expected.courses);
      if (diff.accuracy < ACCURACY_THRESHOLD) {
        // 디버깅용 출력 — Jest test 실패 시 missing/extra 확인

        console.warn(`${name} missing:`, diff.missing);

        console.warn(`${name} extra:`, diff.extra);
      }
      expect(diff.accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
    });
  });
});
