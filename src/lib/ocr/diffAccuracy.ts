// S03 — Ground truth eval: OCR 결과 vs 기대 결과 정확도 산출.
// TEST_PLAN §3.4 기준:
//   - course 정확도 = (모든 필드 매치된 course 수) / (max(actual, expected))
//   - 학기는 별도 검증 (호출자가 처리)

export interface OcrCourseLike {
  name: string;
  day: string;
  start: string;
  end: string;
  room?: string;
}

export interface DiffResult {
  matched: number;
  total: number;
  accuracy: number; // 0..1
  missing: OcrCourseLike[]; // expected에 있는데 actual에 없는 course
  extra: OcrCourseLike[]; // actual에 있는데 expected에 없는 course
}

function normalizeRoom(room: string | undefined): string {
  return (room ?? '').trim().replace(/\s+/g, ' ');
}

function isSameCourse(a: OcrCourseLike, b: OcrCourseLike): boolean {
  return (
    a.name.trim() === b.name.trim() &&
    a.day === b.day &&
    a.start === b.start &&
    a.end === b.end &&
    normalizeRoom(a.room) === normalizeRoom(b.room)
  );
}

export function diffAccuracy(actual: OcrCourseLike[], expected: OcrCourseLike[]): DiffResult {
  const remaining = [...actual];
  const matched: OcrCourseLike[] = [];
  const missing: OcrCourseLike[] = [];

  for (const exp of expected) {
    const idx = remaining.findIndex((a) => isSameCourse(a, exp));
    const found = idx >= 0 ? remaining[idx] : undefined;
    if (found !== undefined) {
      matched.push(found);
      remaining.splice(idx, 1);
    } else {
      missing.push(exp);
    }
  }
  const extra = remaining;

  const total = Math.max(actual.length, expected.length);
  const accuracy = total === 0 ? 1 : matched.length / total;
  return { matched: matched.length, total, accuracy, missing, extra };
}
