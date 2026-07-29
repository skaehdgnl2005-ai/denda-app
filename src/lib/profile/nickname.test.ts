// 닉네임 검증 규칙 — 2026-07-29 스펙 §4.
// 이 파일이 규칙의 진실. 마이그레이션 0024의 CHECK / set_my_nickname RPC가 같은 규칙을 복제하므로
// 규칙을 바꿀 땐 세 곳을 함께 고쳐야 한다(각 위치에 상호 참조 주석 있음).

import { NICKNAME_MAX, NICKNAME_MIN, validateNickname } from './nickname';

describe('validateNickname', () => {
  describe('길이 경계', () => {
    it('1자 → too_short', () => {
      expect(validateNickname('가')).toEqual({ ok: false, reason: 'too_short' });
    });

    it('2자(하한) → 통과', () => {
      expect(validateNickname('민수')).toEqual({ ok: true, value: '민수' });
    });

    it('12자(상한) → 통과', () => {
      const twelve = '가'.repeat(NICKNAME_MAX);
      expect(validateNickname(twelve)).toEqual({ ok: true, value: twelve });
    });

    it('13자 → too_long', () => {
      expect(validateNickname('가'.repeat(NICKNAME_MAX + 1))).toEqual({
        ok: false,
        reason: 'too_long',
      });
    });

    it('빈 문자열 → too_short', () => {
      expect(validateNickname('')).toEqual({ ok: false, reason: 'too_short' });
    });

    it('상수는 2~12', () => {
      expect(NICKNAME_MIN).toBe(2);
      expect(NICKNAME_MAX).toBe(12);
    });
  });

  describe('공백 처리', () => {
    it('앞뒤 공백은 trim 후 검사 — 통과값도 trim된 것', () => {
      expect(validateNickname('  민수  ')).toEqual({ ok: true, value: '민수' });
    });

    it('trim 후 1자면 too_short', () => {
      expect(validateNickname('  가  ')).toEqual({ ok: false, reason: 'too_short' });
    });

    it('중간 공백은 불가 (유니크가 무력해짐 — "지민" vs "지 민")', () => {
      expect(validateNickname('김 민수')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('공백만 → too_short', () => {
      expect(validateNickname('   ')).toEqual({ ok: false, reason: 'too_short' });
    });
  });

  describe('허용 문자', () => {
    it('한글 완성형 통과', () => {
      expect(validateNickname('된다')).toEqual({ ok: true, value: '된다' });
    });

    it('영문 통과', () => {
      expect(validateNickname('minsu')).toEqual({ ok: true, value: 'minsu' });
    });

    it('대문자도 그대로 보존 (유니크만 대소문자 무시)', () => {
      expect(validateNickname('MinSu')).toEqual({ ok: true, value: 'MinSu' });
    });

    it('숫자 통과', () => {
      expect(validateNickname('민수99')).toEqual({ ok: true, value: '민수99' });
    });

    it('밑줄 통과', () => {
      expect(validateNickname('min_su')).toEqual({ ok: true, value: 'min_su' });
    });

    it('한글+영문+숫자 혼합 통과', () => {
      expect(validateNickname('민수Kim2')).toEqual({ ok: true, value: '민수Kim2' });
    });
  });

  describe('거부 문자', () => {
    it('자모 단독(ㄱ) → invalid_chars', () => {
      expect(validateNickname('ㄱㄴ')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('모음 단독(ㅏ) → invalid_chars', () => {
      expect(validateNickname('ㅏㅑ')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('이모지 → invalid_chars', () => {
      expect(validateNickname('민수🙂')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('특수문자(@) → invalid_chars', () => {
      expect(validateNickname('min@su')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('하이픈 → invalid_chars (밑줄만 허용)', () => {
      expect(validateNickname('min-su')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('개행 → invalid_chars', () => {
      expect(validateNickname('민수\n님')).toEqual({ ok: false, reason: 'invalid_chars' });
    });

    it('길이 위반과 문자 위반이 겹치면 길이를 먼저 보고한다', () => {
      // 사용자가 먼저 마주치는 제약이 길이 — 문자 안내를 먼저 띄우면 지우다가 혼란
      expect(validateNickname('@')).toEqual({ ok: false, reason: 'too_short' });
    });
  });

  describe('길이는 코드포인트가 아닌 사용자 인지 문자 수', () => {
    it('결합 문자가 없는 한글은 그대로 2자', () => {
      expect(validateNickname('한글')).toEqual({ ok: true, value: '한글' });
    });
  });
});
