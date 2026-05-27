import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

import { AttributionRoot } from './AttributionRoot';
import { ThemeProvider } from '@/design/theme';
import type { ResolveResult } from './attributionApi';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const GROUP_ID = '11111111-1111-1111-1111-111111111111';

function renderRoot(props: {
  userId: string | undefined;
  resolve: jest.Mock;
  onMatched: jest.Mock;
}) {
  return render(<AttributionRoot {...props} />, { wrapper: ThemeProvider });
}

describe('AttributionRoot', () => {
  test('userId=undefined → resolve 미호출, modal 미표시', () => {
    const resolve = jest.fn();
    const onMatched = jest.fn();
    const { queryByTestId } = renderRoot({ userId: undefined, resolve, onMatched });
    expect(resolve).not.toHaveBeenCalled();
    expect(queryByTestId('invite-code-modal')).toBeNull();
  });

  test('userId 있음 + fingerprint matched=true → onMatched 호출, modal 미표시', async () => {
    const resolve = jest.fn(
      (): Promise<ResolveResult> =>
        Promise.resolve({ matched: true, groupId: GROUP_ID, guestToken: null }),
    );
    const onMatched = jest.fn();
    const { queryByTestId } = renderRoot({ userId: USER_ID, resolve, onMatched });
    await waitFor(() => {
      expect(resolve).toHaveBeenCalledWith({ mode: 'fingerprint' });
      expect(onMatched).toHaveBeenCalledWith(GROUP_ID);
    });
    expect(queryByTestId('invite-code-modal')).toBeNull();
  });

  test('fingerprint matched=false → InviteCodeModal 표시', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const { findByTestId } = renderRoot({ userId: USER_ID, resolve, onMatched });
    await findByTestId('invite-code-modal');
    expect(onMatched).not.toHaveBeenCalled();
  });

  test('fingerprint throw → silent + modal 표시 (invite_code fallback)', async () => {
    const resolve = jest.fn().mockRejectedValueOnce(new Error('network'));
    const onMatched = jest.fn();
    const { findByTestId } = renderRoot({ userId: USER_ID, resolve, onMatched });
    await findByTestId('invite-code-modal');
  });

  test('같은 userId — 재mount해도 resolve 1회만 (in-memory dedup)', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const { rerender } = renderRoot({ userId: USER_ID, resolve, onMatched });
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    rerender(<AttributionRoot userId={USER_ID} resolve={resolve} onMatched={onMatched} />);
    // re-render 후 추가 호출 없음
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('userId 변경(로그아웃→재로그인) → resolve 다시 호출', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const { rerender } = renderRoot({ userId: USER_ID, resolve, onMatched });
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    rerender(<AttributionRoot userId={undefined} resolve={resolve} onMatched={onMatched} />);
    rerender(<AttributionRoot userId="other-user-id" resolve={resolve} onMatched={onMatched} />);
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
  });
});
