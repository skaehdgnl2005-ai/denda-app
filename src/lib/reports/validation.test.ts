import { validateReportInput, REPORT_DETAIL_MAX_LENGTH } from './validation';

describe('reports/validation', () => {
  describe('REPORT_DETAIL_MAX_LENGTH', () => {
    it('500자 cap (DB schema는 TEXT 무제한, UX-side cap)', () => {
      expect(REPORT_DETAIL_MAX_LENGTH).toBe(500);
    });
  });

  describe('validateReportInput', () => {
    describe('reason 검증', () => {
      it('schema enum 5개 reason은 모두 valid', () => {
        for (const reason of ['spam', 'harassment', 'inappropriate', 'fake_profile', 'other']) {
          const result = validateReportInput({ targetUserId: 'u-1', reason, detail: '' });
          expect(result.valid).toBe(true);
        }
      });

      it('schema에 없는 reason은 invalid + 한국어 에러', () => {
        const result = validateReportInput({ targetUserId: 'u-1', reason: 'fraud', detail: '' });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toMatch(/사유/);
        }
      });

      it('빈 reason은 invalid', () => {
        const result = validateReportInput({ targetUserId: 'u-1', reason: '', detail: '' });
        expect(result.valid).toBe(false);
      });
    });

    describe('detail 검증', () => {
      it('detail 빈 문자열 OK (schema TEXT nullable)', () => {
        const result = validateReportInput({ targetUserId: 'u-1', reason: 'spam', detail: '' });
        expect(result.valid).toBe(true);
      });

      it('detail 500자 정확히 OK', () => {
        const detail = 'ㄱ'.repeat(500);
        const result = validateReportInput({ targetUserId: 'u-1', reason: 'spam', detail });
        expect(result.valid).toBe(true);
      });

      it('detail 501자 invalid + 한국어 에러', () => {
        const detail = 'ㄱ'.repeat(501);
        const result = validateReportInput({ targetUserId: 'u-1', reason: 'spam', detail });
        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error).toMatch(/500자/);
        }
      });

      it('detail undefined 허용 (optional)', () => {
        const result = validateReportInput({ targetUserId: 'u-1', reason: 'spam' });
        expect(result.valid).toBe(true);
      });
    });

    describe('targetUserId 검증', () => {
      it('빈 targetUserId invalid', () => {
        const result = validateReportInput({ targetUserId: '', reason: 'spam', detail: '' });
        expect(result.valid).toBe(false);
      });

      it('whitespace-only targetUserId invalid', () => {
        const result = validateReportInput({ targetUserId: '   ', reason: 'spam', detail: '' });
        expect(result.valid).toBe(false);
      });
    });
  });
});
