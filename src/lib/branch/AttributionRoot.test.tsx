import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';

import { AttributionRoot, ATTRIBUTION_ATTEMPT_KEY } from './AttributionRoot';
import { ThemeProvider } from '@/design/theme';
import type { AttributionStorage } from './AttributionRoot';
import type { ResolveResult } from './attributionApi';

const USER_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const GROUP_ID = '11111111-1111-1111-1111-111111111111';

/** 기본 storage — 플래그 없음(첫 실행). */
function makeStorage(initial: string | null = null): AttributionStorage & {
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
} {
  return {
    getItemAsync: jest.fn().mockResolvedValue(initial),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
  };
}

function renderRoot(props: {
  userId: string | undefined;
  resolve: jest.Mock;
  onMatched: jest.Mock;
  storage?: AttributionStorage;
}) {
  const storage = props.storage ?? makeStorage();
  return render(<AttributionRoot {...props} storage={storage} />, { wrapper: ThemeProvider });
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
    const storage = makeStorage();
    const { rerender } = renderRoot({ userId: USER_ID, resolve, onMatched, storage });
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    rerender(
      <AttributionRoot
        userId={USER_ID}
        resolve={resolve}
        onMatched={onMatched}
        storage={storage}
      />,
    );
    // re-render 후 추가 호출 없음
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  test('userId 변경(로그아웃→재로그인) → resolve 다시 호출', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const storage = makeStorage();
    const { rerender } = renderRoot({ userId: USER_ID, resolve, onMatched, storage });
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    rerender(
      <AttributionRoot
        userId={undefined}
        resolve={resolve}
        onMatched={onMatched}
        storage={storage}
      />,
    );
    rerender(
      <AttributionRoot
        userId="other-user-id"
        resolve={resolve}
        onMatched={onMatched}
        storage={storage}
      />,
    );
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(2));
  });

  // ── 영속 dedup (앱 재시작 시나리오) ──────────────────────────────────────
  // 콜드 스타트마다 ref가 초기화되므로 storage 플래그가 없으면 모달이 매번 뜬다.

  test('첫 시도 시 storage에 userId 기록 (다음 launch 차단)', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const storage = makeStorage();
    renderRoot({ userId: USER_ID, resolve, onMatched, storage });
    await waitFor(() => {
      expect(storage.setItemAsync).toHaveBeenCalledWith(ATTRIBUTION_ATTEMPT_KEY, USER_ID);
    });
  });

  test('storage에 같은 userId 기록됨(앱 재시작) → resolve 미호출 + modal 미표시', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const storage = makeStorage(USER_ID);
    const { queryByTestId } = renderRoot({ userId: USER_ID, resolve, onMatched, storage });
    await waitFor(() => expect(storage.getItemAsync).toHaveBeenCalledWith(ATTRIBUTION_ATTEMPT_KEY));
    await act(async () => {
      await Promise.resolve();
    });
    expect(resolve).not.toHaveBeenCalled();
    expect(queryByTestId('invite-code-modal')).toBeNull();
  });

  test('storage에 다른 userId 기록(계정 변경) → resolve 호출', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const storage = makeStorage('previous-user-id');
    renderRoot({ userId: USER_ID, resolve, onMatched, storage });
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
  });

  test('storage read 실패 → best-effort로 resolve 시도 (mount lifetime dedup으로 degrade)', async () => {
    const resolve = jest.fn((): Promise<ResolveResult> => Promise.resolve({ matched: false }));
    const onMatched = jest.fn();
    const storage = makeStorage();
    storage.getItemAsync.mockRejectedValue(new Error('SecureStore 접근 실패'));
    const { findByTestId } = renderRoot({ userId: USER_ID, resolve, onMatched, storage });
    await findByTestId('invite-code-modal');
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
