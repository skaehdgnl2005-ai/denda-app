import { resolveAttribution } from './attributionApi';

describe('resolveAttribution — Edge Function POST', () => {
  let invokeMock: jest.Mock;
  let mockClient: { functions: { invoke: jest.Mock } };

  beforeEach(() => {
    invokeMock = jest.fn();
    mockClient = { functions: { invoke: invokeMock } };
  });

  describe('mode=fingerprint', () => {
    it('Edge Function name + body', async () => {
      invokeMock.mockResolvedValue({
        data: { matched: false },
        error: null,
      });
      await resolveAttribution(mockClient as never, { mode: 'fingerprint' });
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(invokeMock.mock.calls[0][0]).toBe('attribution_resolve');
      expect(invokeMock.mock.calls[0][1]).toEqual({
        body: { mode: 'fingerprint' },
      });
    });

    it('matched=true 시 group_id + guest_token 반환', async () => {
      invokeMock.mockResolvedValue({
        data: {
          matched: true,
          group_id: '11111111-1111-1111-1111-111111111111',
          guest_token: '22222222-2222-2222-2222-222222222222',
        },
        error: null,
      });
      const res = await resolveAttribution(mockClient as never, { mode: 'fingerprint' });
      expect(res).toEqual({
        matched: true,
        groupId: '11111111-1111-1111-1111-111111111111',
        guestToken: '22222222-2222-2222-2222-222222222222',
      });
    });

    it('matched=false', async () => {
      invokeMock.mockResolvedValue({
        data: { matched: false },
        error: null,
      });
      const res = await resolveAttribution(mockClient as never, { mode: 'fingerprint' });
      expect(res).toEqual({ matched: false });
    });
  });

  describe('mode=invite_code', () => {
    it('4자리 code body 전달', async () => {
      invokeMock.mockResolvedValue({
        data: { matched: true, group_id: '11111111-1111-1111-1111-111111111111' },
        error: null,
      });
      await resolveAttribution(mockClient as never, {
        mode: 'invite_code',
        code: '0042',
      });
      expect(invokeMock.mock.calls[0][1]).toEqual({
        body: { mode: 'invite_code', code: '0042' },
      });
    });

    it('matched=true 시 guest_token=null 정상', async () => {
      invokeMock.mockResolvedValue({
        data: { matched: true, group_id: 'g', guest_token: null },
        error: null,
      });
      const res = await resolveAttribution(mockClient as never, {
        mode: 'invite_code',
        code: '0042',
      });
      expect(res).toEqual({ matched: true, groupId: 'g', guestToken: null });
    });
  });

  describe('에러 케이스', () => {
    it('Edge Function error → 한국어 wrapper throw', async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { message: 'Server boom' },
      });
      await expect(
        resolveAttribution(mockClient as never, { mode: 'fingerprint' }),
      ).rejects.toThrow(/모임 합류에 실패/);
    });

    it('invite_code 형식 오류 — Edge가 4자리 숫자 메시지로 응답', async () => {
      invokeMock.mockResolvedValue({
        data: null,
        error: { message: '4자리 숫자' },
      });
      await expect(
        resolveAttribution(mockClient as never, {
          mode: 'invite_code',
          code: 'abcd',
        }),
      ).rejects.toThrow(/4자리 숫자/);
    });
  });
});
