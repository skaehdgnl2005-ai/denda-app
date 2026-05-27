import { buildSharePlaceMessage, sharePlaceToKakao } from './kakaoShare';

describe('buildSharePlaceMessage', () => {
  it('groupName + placeName + url 포함', () => {
    const message = buildSharePlaceMessage({
      groupName: '5/30 저녁',
      placeName: '한솥도시락 안암점',
      url: 'https://denda.vercel.app/p/abc',
    });
    expect(message).toContain('5/30 저녁');
    expect(message).toContain('한솥도시락 안암점');
    expect(message).toContain('https://denda.vercel.app/p/abc');
  });

  it('url 미명시 → url 없는 message 반환', () => {
    const message = buildSharePlaceMessage({
      groupName: '5/30 저녁',
      placeName: '한솥도시락 안암점',
    });
    expect(message).toContain('5/30 저녁');
    expect(message).toContain('한솥도시락 안암점');
    expect(message).not.toContain('http');
  });

  it('groupName 빈 문자열 → "모임" fallback', () => {
    const message = buildSharePlaceMessage({
      groupName: '',
      placeName: '한솥도시락 안암점',
    });
    expect(message).toContain('모임');
    expect(message).toContain('한솥도시락 안암점');
  });

  it('placeName 빈 문자열 → "장소" fallback', () => {
    const message = buildSharePlaceMessage({
      groupName: '5/30 저녁',
      placeName: '',
    });
    expect(message).toContain('5/30 저녁');
    expect(message).toContain('장소');
  });
});

describe('sharePlaceToKakao', () => {
  it('share API success "sharedAction" → result.shared=true', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    };
    const result = await sharePlaceToKakao(
      {
        groupName: '5/30 저녁',
        placeName: '한솥도시락 안암점',
        url: 'https://denda.vercel.app/p/abc',
      },
      { shareApi },
    );
    expect(result.shared).toBe(true);
    expect(shareApi.share).toHaveBeenCalledTimes(1);
    const [callArgs] = shareApi.share.mock.calls;
    expect(callArgs?.[0]?.message).toContain('한솥도시락');
  });

  it('share API "dismissedAction" → result.shared=false (사용자 취소)', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'dismissedAction' }),
    };
    const result = await sharePlaceToKakao({ groupName: '모임', placeName: '식당' }, { shareApi });
    expect(result.shared).toBe(false);
  });

  it('share API throw → "공유에 실패했어요" 한국어 throw', async () => {
    const shareApi = {
      share: jest.fn().mockRejectedValue(new Error('platform error')),
    };
    await expect(
      sharePlaceToKakao({ groupName: '모임', placeName: '식당' }, { shareApi }),
    ).rejects.toThrow(/공유에 실패/);
  });

  it('url 전달 시 share API에 url 같이 전달', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    };
    await sharePlaceToKakao(
      {
        groupName: '모임',
        placeName: '식당',
        url: 'https://example.com',
      },
      { shareApi },
    );
    const [callArgs] = shareApi.share.mock.calls;
    expect(callArgs?.[0]?.url).toBe('https://example.com');
  });

  it('url 미명시 → share content에 url 키 없음', async () => {
    const shareApi = {
      share: jest.fn().mockResolvedValue({ action: 'sharedAction' }),
    };
    await sharePlaceToKakao({ groupName: '모임', placeName: '식당' }, { shareApi });
    const [callArgs] = shareApi.share.mock.calls;
    expect(callArgs?.[0]?.url).toBeUndefined();
  });
});
