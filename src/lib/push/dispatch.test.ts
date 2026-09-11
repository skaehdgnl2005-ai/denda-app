// S23: client push dispatch wrapper tests.
//
// notify_publish Edge에 type-safe POST를 보내는 wrapper. 호출자는 silent best-effort —
// push 실패가 친구 요청/수락/모임 초대 UX 차단 X.

import { dispatch, eventToPublishBody } from './dispatch';
import { supabase } from '@/lib/supabase/client';

jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;

beforeEach(() => {
  mockInvoke.mockReset();
  mockInvoke.mockResolvedValue({ data: null, error: null });
});

describe('eventToPublishBody', () => {
  test('friend_requested → snake_case body', () => {
    expect(
      eventToPublishBody({
        type: 'friend_requested',
        fromUserId: 'u1',
        toUserId: 'u2',
      }),
    ).toEqual({ type: 'friend_requested', from_user_id: 'u1', to_user_id: 'u2' });
  });

  test('friend_accepted → snake_case body', () => {
    expect(
      eventToPublishBody({
        type: 'friend_accepted',
        fromUserId: 'u1',
        toUserId: 'u2',
      }),
    ).toEqual({ type: 'friend_accepted', from_user_id: 'u1', to_user_id: 'u2' });
  });

  test('group_invited → snake_case body', () => {
    expect(
      eventToPublishBody({
        type: 'group_invited',
        groupId: 'g1',
        inviterId: 'u1',
        inviteeId: 'u2',
      }),
    ).toEqual({
      type: 'group_invited',
      group_id: 'g1',
      inviter_id: 'u1',
      invitee_id: 'u2',
    });
  });
});

describe('dispatch', () => {
  test('friend_requested → notify_publish invoke', async () => {
    await dispatch({
      type: 'friend_requested',
      fromUserId: 'u1',
      toUserId: 'u2',
    });
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('notify_publish', {
      body: { type: 'friend_requested', from_user_id: 'u1', to_user_id: 'u2' },
    });
  });

  test('friend_accepted → notify_publish invoke', async () => {
    await dispatch({
      type: 'friend_accepted',
      fromUserId: 'u1',
      toUserId: 'u2',
    });
    expect(mockInvoke).toHaveBeenCalledWith('notify_publish', {
      body: { type: 'friend_accepted', from_user_id: 'u1', to_user_id: 'u2' },
    });
  });

  test('group_invited → notify_publish invoke', async () => {
    await dispatch({
      type: 'group_invited',
      groupId: 'g1',
      inviterId: 'u1',
      inviteeId: 'u2',
    });
    expect(mockInvoke).toHaveBeenCalledWith('notify_publish', {
      body: {
        type: 'group_invited',
        group_id: 'g1',
        inviter_id: 'u1',
        invitee_id: 'u2',
      },
    });
  });

  test('invoke throw → silent (호출자 throw 안 됨)', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network'));
    await expect(
      dispatch({ type: 'friend_requested', fromUserId: 'u1', toUserId: 'u2' }),
    ).resolves.toBeUndefined();
  });

  test('invoke가 error response 반환해도 silent', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { name: 'FunctionsHttpError', message: '500', context: {} },
    } as unknown as Awaited<ReturnType<typeof mockInvoke>>);
    await expect(
      dispatch({ type: 'friend_requested', fromUserId: 'u1', toUserId: 'u2' }),
    ).resolves.toBeUndefined();
  });
});
