// profile/api — set_my_nickname RPC 호출 + 에러 코드 매핑, 내 프로필 조회.
// 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §4.
//
// 설계 핵심: 예상 가능한 실패(중복·규칙 위반)는 throw하지 않고 { ok:false, reason }으로 돌려준다.
// throw하면 호출부가 mapError()를 태우고, mapError는 raw 메시지를 버리고 일반 카피로 덮어써서
// "이미 사용 중인 닉네임이에요"가 "문제가 생겼어요"로 바뀐다.

import { fetchMyProfile, setMyNickname } from './api';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;

const ME = '00000000-0000-0000-0000-000000000001';

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe('setMyNickname', () => {
  test('성공 → { ok: true } + RPC에 trim된 값 전달', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await setMyNickname('  민수  ');

    expect(mockRpc).toHaveBeenCalledWith('set_my_nickname', { p_nickname: '민수' });
    expect(result).toEqual({ ok: true, value: '민수' });
  });

  test('클라이언트 규칙 위반은 RPC를 때리지 않는다 (왕복 절약)', async () => {
    const result = await setMyNickname('가');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'too_short' });
  });

  test('허용 안 되는 문자도 RPC 전에 차단', async () => {
    const result = await setMyNickname('min@su');

    expect(mockRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'invalid_chars' });
  });

  test('nickname_taken → { ok:false, reason:"taken" } (throw 아님)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'nickname_taken', code: 'P0001' },
    });

    await expect(setMyNickname('민수')).resolves.toEqual({ ok: false, reason: 'taken' });
  });

  test('서버가 규칙 위반을 잡은 경우도 reason으로 환원 (클라 규칙이 뒤처졌을 때)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'nickname_invalid_chars', code: 'P0001' },
    });

    await expect(setMyNickname('민수')).resolves.toEqual({ ok: false, reason: 'invalid_chars' });
  });

  test('nickname_too_long → too_long', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'nickname_too_long' } });
    await expect(setMyNickname('민수')).resolves.toEqual({ ok: false, reason: 'too_long' });
  });

  test('not_authenticated → throw (로그인 만료는 화면이 다르게 처리해야 함)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'not_authenticated' } });

    await expect(setMyNickname('민수')).rejects.toThrow();
  });

  test('예상 밖 에러 → throw (호출부가 mapError로 일반 카피 표시)', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'network request failed' },
    });

    await expect(setMyNickname('민수')).rejects.toThrow();
  });

  test('throw되는 에러에 raw 서버 메시지를 담지 않는다', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for relation users' },
    });

    await expect(setMyNickname('민수')).rejects.toThrow(/저장하지 못했어요/);
  });
});

describe('fetchMyProfile', () => {
  function mockSingle(value: unknown): jest.Mock {
    const single = jest.fn().mockResolvedValue(value);
    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });
    return select;
  }

  test('users row → 카멜케이스로 매핑', async () => {
    const select = mockSingle({
      data: {
        nickname: '민수',
        profile_image_url: 'https://img',
        nickname_set_at: '2026-07-29T00:00:00Z',
      },
      error: null,
    });

    const profile = await fetchMyProfile(ME);

    expect(mockFrom).toHaveBeenCalledWith('users');
    expect(select).toHaveBeenCalledWith('nickname, profile_image_url, nickname_set_at');
    expect(profile).toEqual({
      nickname: '민수',
      profileImageUrl: 'https://img',
      nicknameSetAt: '2026-07-29T00:00:00Z',
    });
  });

  test('아직 직접 정하지 않은 사용자 → nicknameSetAt null', async () => {
    mockSingle({
      data: { nickname: '카톡이름', profile_image_url: null, nickname_set_at: null },
      error: null,
    });

    await expect(fetchMyProfile(ME)).resolves.toEqual({
      nickname: '카톡이름',
      profileImageUrl: null,
      nicknameSetAt: null,
    });
  });

  test('에러 → null (앱을 막지 않는다 — 카톡 이름 폴백 유지)', async () => {
    mockSingle({ data: null, error: { message: 'network' } });
    await expect(fetchMyProfile(ME)).resolves.toBeNull();
  });

  test('row 없음(삭제된 계정) → null', async () => {
    mockSingle({ data: null, error: null });
    await expect(fetchMyProfile(ME)).resolves.toBeNull();
  });
});
