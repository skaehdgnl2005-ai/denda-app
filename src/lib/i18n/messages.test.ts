import { messages, mapError } from './messages';

describe('messages (§17.6 마이크로카피 시드)', () => {
  test('성공 메시지는 비어있지 않고 친근체 어미(요/!)로 끝난다', () => {
    const samples = [
      messages.success.requestSent,
      messages.success.joined,
      messages.success.blocked,
    ];
    for (const m of samples) {
      expect(m.length).toBeGreaterThan(0);
      expect(m).toMatch(/[요!\.]$/);
    }
  });

  test('invited(n)은 인원 수를 보간한다', () => {
    expect(messages.success.invited(3)).toBe('3명에게 초대를 보냈어요!');
    expect(messages.success.invited(1)).toBe('1명에게 초대를 보냈어요!');
  });

  test('에러 카피는 자책 없이 함께 해결하는 톤이다 (다시 시도해볼게요)', () => {
    // permission은 사용자 행동이 실제 필요해 예외(안내형). 나머지는 §17.6 협력 톤 일관.
    for (const key of ['generic', 'network', 'load', 'save', 'rateLimit', 'expired'] as const) {
      expect(messages.error[key]).toMatch(/다시 시도해볼게요/);
    }
  });

  test('빈 상태는 §11.2 3요소(title·body·cta) 형태를 갖춘다', () => {
    const empty = messages.empty.homeGroups;
    expect(empty.title.length).toBeGreaterThan(0);
    expect(empty.body.length).toBeGreaterThan(0);
    expect(empty.cta.length).toBeGreaterThan(0);
  });
});

describe('mapError (raw 메시지 노출 방지)', () => {
  test('취소류(AbortError)는 silent 처리 — 에러로 표출 안 함', () => {
    const abort = new Error('Aborted');
    abort.name = 'AbortError';
    expect(mapError(abort)).toEqual({ silent: true, message: '' });
  });

  test('네트워크 오류는 네트워크 카피로 매핑된다', () => {
    const netErr = new Error('TypeError: Network request failed');
    const res = mapError(netErr);
    expect(res.silent).toBe(false);
    expect(res.message).toBe(messages.error.network);
  });

  test('raw err.message를 절대 그대로 노출하지 않는다', () => {
    const leaky = new Error('column "xyz" does not exist at line 42 (PGRST123)');
    const res = mapError(leaky);
    expect(res.message).not.toContain('PGRST123');
    expect(res.message).not.toContain('column');
    expect(res.message).toBe(messages.error.generic);
  });

  test('문자열·undefined·null 등 비-Error도 안전하게 generic으로', () => {
    expect(mapError('boom').message).toBe(messages.error.generic);
    expect(mapError(undefined).message).toBe(messages.error.generic);
    expect(mapError(null).message).toBe(messages.error.generic);
    expect(mapError({ weird: true }).message).toBe(messages.error.generic);
    expect(mapError('boom').silent).toBe(false);
  });
});
