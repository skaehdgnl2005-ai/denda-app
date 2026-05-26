import { formatInviteCode, isValidInviteCode, parseInviteCode } from './inviteCode';

describe('formatInviteCode', () => {
  it('0을 4자리 0-padding으로 반환', () => {
    expect(formatInviteCode(0)).toBe('0000');
  });

  it('두 자리 숫자를 0-padding', () => {
    expect(formatInviteCode(42)).toBe('0042');
  });

  it('네 자리 숫자는 그대로', () => {
    expect(formatInviteCode(9999)).toBe('9999');
  });

  it('numeric string 입력 허용', () => {
    expect(formatInviteCode('42')).toBe('0042');
    expect(formatInviteCode('0042')).toBe('0042');
    expect(formatInviteCode('9999')).toBe('9999');
  });

  it('음수는 throw', () => {
    expect(() => formatInviteCode(-1)).toThrow();
  });

  it('10000 이상은 throw', () => {
    expect(() => formatInviteCode(10000)).toThrow();
    expect(() => formatInviteCode(12345)).toThrow();
  });

  it('소수는 throw', () => {
    expect(() => formatInviteCode(1.5)).toThrow();
  });

  it('non-numeric string은 throw', () => {
    expect(() => formatInviteCode('abc')).toThrow();
    expect(() => formatInviteCode('12a4')).toThrow();
  });

  it('빈 문자열은 throw', () => {
    expect(() => formatInviteCode('')).toThrow();
  });

  it('NaN은 throw', () => {
    expect(() => formatInviteCode(NaN)).toThrow();
  });

  it('Infinity는 throw', () => {
    expect(() => formatInviteCode(Infinity)).toThrow();
  });
});

describe('parseInviteCode', () => {
  it('정확히 4자리 numeric 입력 통과', () => {
    expect(parseInviteCode('0042')).toBe('0042');
    expect(parseInviteCode('1234')).toBe('1234');
    expect(parseInviteCode('0000')).toBe('0000');
    expect(parseInviteCode('9999')).toBe('9999');
  });

  it('앞뒤 공백 trim', () => {
    expect(parseInviteCode('  0042  ')).toBe('0042');
    expect(parseInviteCode('\t1234\n')).toBe('1234');
  });

  it('4자리 미만은 null', () => {
    expect(parseInviteCode('42')).toBeNull();
    expect(parseInviteCode('123')).toBeNull();
    expect(parseInviteCode('')).toBeNull();
  });

  it('5자리 이상은 null', () => {
    expect(parseInviteCode('12345')).toBeNull();
    expect(parseInviteCode('00042')).toBeNull();
  });

  it('non-numeric 문자 포함 시 null', () => {
    expect(parseInviteCode('abcd')).toBeNull();
    expect(parseInviteCode('12a4')).toBeNull();
    expect(parseInviteCode('12.4')).toBeNull();
    expect(parseInviteCode('12-4')).toBeNull();
  });

  it('중간 공백 포함은 null (trim 후 4자리 정확히)', () => {
    expect(parseInviteCode('00 42')).toBeNull();
    expect(parseInviteCode('0 042')).toBeNull();
  });

  it('null/undefined-like 입력은 null', () => {
    expect(parseInviteCode('   ')).toBeNull();
  });
});

describe('isValidInviteCode', () => {
  it('"0000" ~ "9999" 4자리 numeric은 true', () => {
    expect(isValidInviteCode('0000')).toBe(true);
    expect(isValidInviteCode('9999')).toBe(true);
    expect(isValidInviteCode('1234')).toBe(true);
  });

  it('4자리 아니면 false', () => {
    expect(isValidInviteCode('123')).toBe(false);
    expect(isValidInviteCode('12345')).toBe(false);
    expect(isValidInviteCode('')).toBe(false);
  });

  it('non-numeric 포함은 false', () => {
    expect(isValidInviteCode('abc4')).toBe(false);
    expect(isValidInviteCode('12.4')).toBe(false);
    expect(isValidInviteCode(' 123')).toBe(false);
  });
});
