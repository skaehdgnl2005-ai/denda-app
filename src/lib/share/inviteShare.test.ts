import { buildInviteMessage, shareInviteToKakao } from './inviteShare';

describe('buildInviteMessage', () => {
  it('inviterNickname 포함 시 "○○님이 함께하자고 해요" 머리말', () => {
    const message = buildInviteMessage({ inviterNickname: '민지' });
    expect(message).toContain('민지');
  });

  it('inviterNickname 미명시 → 일반 안내 머리말', () => {
    const message = buildInviteMessage({});
    expect(message.length).toBeGreaterThan(0);
    expect(message).not.toContain('undefined');
  });

  it('inviterNickname 빈 문자열 → 일반 안내 머리말 (이름 자리 비우지 않음)', () => {
    const message = buildInviteMessage({ inviterNickname: '   ' });
    expect(message).not.toContain('   님');
  });

  it('앱 이름 "된다" 포함', () => {
    const message = buildInviteMessage({ inviterNickname: '민지' });
    expect(message).toContain('된다');
  });
});

describe('shareInviteToKakao', () => {
  it('share API success "sharedAction" → result.shared=true', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    };
    const result = await shareInviteToKakao({ inviterNickname: '민지' }, { shareApi });
    expect(result.shared).toBe(true);
    expect(shareApi.share).toHaveBeenCalledTimes(1);
    const [callArgs] = shareApi.share.mock.calls;
    expect(callArgs?.[0]?.message).toContain('민지');
  });

  it('share API "dismissedAction" → result.shared=false (사용자 취소)', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'dismissedAction' }),
    };
    const result = await shareInviteToKakao({ inviterNickname: '민지' }, { shareApi });
    expect(result.shared).toBe(false);
  });

  it('share API throw → "공유에 실패했어요" 한국어 throw', async () => {
    const shareApi = {
      share: jest.fn().mockRejectedValue(new Error('platform error')),
    };
    await expect(shareInviteToKakao({ inviterNickname: '민지' }, { shareApi })).rejects.toThrow(
      /공유에 실패/,
    );
  });

  it('shareApi 미주입 → "shareApi 가 필요해요" 한국어 throw', async () => {
    await expect(shareInviteToKakao({ inviterNickname: '민지' })).rejects.toThrow(/shareApi/);
  });

  it('inviterNickname 미명시도 share API 호출 (일반 안내 메시지)', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    };
    const result = await shareInviteToKakao({}, { shareApi });
    expect(result.shared).toBe(true);
    expect(shareApi.share).toHaveBeenCalledTimes(1);
  });
});
