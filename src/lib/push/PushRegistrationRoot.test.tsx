// PushRegistrationRoot — DI-first 전역 mount 컴포넌트 tests.
//
// userId 변경 시 registerForPushNotifications 호출. 에러는 silent.
// expo-notifications + react-native Platform은 DI로 mock.

import { render, act } from '@testing-library/react-native';

import {
  PushRegistrationRoot,
  type PushRegistrationRootProps,
} from './PushRegistrationRoot';
import type { ExpoNotificationsApi, PlatformApi } from './expoNotifications';

const mockNotifications: ExpoNotificationsApi = {
  getPermissionsAsync: () => Promise.resolve({ granted: true }),
  requestPermissionsAsync: () => Promise.resolve({ granted: true }),
  getExpoPushTokenAsync: () =>
    Promise.resolve({ data: 'ExponentPushToken[stub]' }),
  setNotificationHandler: () => {},
};

const mockPlatform: PlatformApi = { OS: 'ios' };

function makeProps(overrides: Partial<PushRegistrationRootProps> = {}): {
  props: PushRegistrationRootProps;
  registerCalls: Array<{ userId: string }>;
  handlerSetCount: { count: number };
} {
  const registerCalls: Array<{ userId: string }> = [];
  const handlerSetCount = { count: 0 };

  const props: PushRegistrationRootProps = {
    userId: undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: {} as any,
    notifications: {
      ...mockNotifications,
      setNotificationHandler: () => {
        handlerSetCount.count++;
      },
    },
    platform: mockPlatform,
    projectId: 'denda-proj',
    register: async (args) => {
      registerCalls.push({ userId: args.userId });
      return { granted: true, token: 'ExponentPushToken[stub]' };
    },
    ...overrides,
  };
  return { props, registerCalls, handlerSetCount };
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('PushRegistrationRoot', () => {
  it('userId undefined → register skip', async () => {
    const { props, registerCalls } = makeProps();
    render(<PushRegistrationRoot {...props} />);
    await flush();
    expect(registerCalls).toHaveLength(0);
  });

  it('userId set → register 호출', async () => {
    const { props, registerCalls } = makeProps({ userId: 'u1' });
    render(<PushRegistrationRoot {...props} />);
    await flush();
    expect(registerCalls).toHaveLength(1);
    expect(registerCalls[0]?.userId).toBe('u1');
  });

  it('userId 변경 → 새 userId로 register', async () => {
    const { props, registerCalls } = makeProps({ userId: 'u1' });
    const result = render(<PushRegistrationRoot {...props} />);
    await flush();
    expect(registerCalls).toHaveLength(1);

    result.rerender(<PushRegistrationRoot {...props} userId="u2" />);
    await flush();
    expect(registerCalls).toHaveLength(2);
    expect(registerCalls[1]?.userId).toBe('u2');
  });

  it('register throw → silent (앱 죽지 않음)', async () => {
    const { props } = makeProps({
      userId: 'u1',
      register: async () => {
        throw new Error('network');
      },
    });
    // throw 안 함 = silent
    expect(() => render(<PushRegistrationRoot {...props} />)).not.toThrow();
    await flush();
  });

  it('setNotificationHandler는 mount 시 1회만 호출', async () => {
    const { props, handlerSetCount } = makeProps({ userId: 'u1' });
    const result = render(<PushRegistrationRoot {...props} />);
    await flush();
    expect(handlerSetCount.count).toBe(1);

    // userId 변경에도 handler set은 추가 호출 X
    result.rerender(<PushRegistrationRoot {...props} userId="u2" />);
    await flush();
    expect(handlerSetCount.count).toBe(1);
  });

  it('userId set → null → set 시 두 번 register (재로그인)', async () => {
    const { props, registerCalls } = makeProps({ userId: 'u1' });
    const result = render(<PushRegistrationRoot {...props} />);
    await flush();
    expect(registerCalls).toHaveLength(1);

    result.rerender(<PushRegistrationRoot {...props} userId={undefined} />);
    await flush();
    expect(registerCalls).toHaveLength(1); // undefined는 skip

    result.rerender(<PushRegistrationRoot {...props} userId="u1" />);
    await flush();
    expect(registerCalls).toHaveLength(2); // 재로그인
  });
});
