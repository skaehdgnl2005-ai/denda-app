import { REPORT_REASONS, REPORT_REASON_KEYS, getReasonLabel, isValidReasonKey } from './reasons';

describe('reports/reasons', () => {
  describe('REPORT_REASONS', () => {
    it('schema enum과 정합하는 5개 사유를 가진다', () => {
      const keys = REPORT_REASONS.map((r) => r.key);
      expect(keys).toEqual(['spam', 'harassment', 'inappropriate', 'fake_profile', 'other']);
    });

    it('모든 사유에 한국어 label이 있다', () => {
      for (const reason of REPORT_REASONS) {
        expect(reason.label.length).toBeGreaterThan(0);
        // 한국어 포함 검증 (Hangul Syllables 범위)
        expect(reason.label).toMatch(/[가-힣]/);
      }
    });
  });

  describe('REPORT_REASON_KEYS', () => {
    it('REPORT_REASONS의 key만 추출한 readonly 배열', () => {
      expect(REPORT_REASON_KEYS).toEqual([
        'spam',
        'harassment',
        'inappropriate',
        'fake_profile',
        'other',
      ]);
    });
  });

  describe('getReasonLabel', () => {
    it('유효 key에 대해 정확한 label을 반환한다', () => {
      expect(getReasonLabel('spam')).toBe('스팸 및 광고');
      expect(getReasonLabel('harassment')).toBe('욕설 및 괴롭힘');
      expect(getReasonLabel('inappropriate')).toBe('부적절한 닉네임/프로필');
      expect(getReasonLabel('fake_profile')).toBe('사칭 및 가짜 프로필');
      expect(getReasonLabel('other')).toBe('기타');
    });
  });

  describe('isValidReasonKey', () => {
    it('schema enum 5개에 대해 true를 반환한다', () => {
      expect(isValidReasonKey('spam')).toBe(true);
      expect(isValidReasonKey('harassment')).toBe(true);
      expect(isValidReasonKey('inappropriate')).toBe(true);
      expect(isValidReasonKey('fake_profile')).toBe(true);
      expect(isValidReasonKey('other')).toBe(true);
    });

    it('schema에 없는 key에 대해 false를 반환한다', () => {
      expect(isValidReasonKey('fraud')).toBe(false); // 이전 mismatch
      expect(isValidReasonKey('')).toBe(false);
      expect(isValidReasonKey('hate')).toBe(false);
      expect(isValidReasonKey('SPAM')).toBe(false); // 대소문자 strict
    });
  });
});
