// 인증 화면(로그인·온보딩·약관·개인정보·법적고지)을 Figma 아트보드로 내보낸다.
// mock 세트는 tests/screens/(auth)/*.test.tsx에서 이미 통과가 검증된 것을 그대로 복제했다.
//
// 실행: npm run figma:dump
import React from 'react';
import { View } from 'react-native';
import { act, render, type RenderResult } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/design/theme';
import { type AuthProviderError } from '@/lib/auth/AuthProvider';
import { emitPart } from './emit';
import { fromTestInstance, normalize, type SourceNode } from './normalize';
import type { IRArtboard, IRNode } from './ir';

// --- mock (테스트 원본과 동일) -------------------------------------------------

let mockParams: { doc?: string } = {};
jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => mockParams,
}));

// 로그인 화면은 status·lastError를 selector로 읽는다. 픽스처마다 갈아끼운다.
let mockStatus: 'signed_out' | 'authenticating' = 'signed_out';
let mockLastError: AuthProviderError | null = null;

jest.mock('@/lib/auth/setup', () => ({
  useAuth: <T,>(sel: (s: { status: string; lastError: AuthProviderError | null }) => T) =>
    sel({ status: mockStatus, lastError: mockLastError }),
  authStore: {
    getState: () => ({
      signIn: jest.fn(),
      completeOnboarding: jest.fn(),
      agreeToTerms: jest.fn(),
    }),
  },
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const useColorSchemeMock = require('react-native/Libraries/Utilities/useColorScheme')
  .default as jest.Mock;

// mock 등록 이후에 import해야 한다.
/* eslint-disable @typescript-eslint/no-require-imports */
const LoginScreen = require('../../app/(auth)/login').default as React.ComponentType;
const OnboardingScreen = require('../../app/(auth)/onboarding').default as React.ComponentType;
const TermsScreen = require('../../app/(auth)/terms').default as React.ComponentType;
const PrivacyScreen = require('../../app/(auth)/privacy').default as React.ComponentType;
const LegalScreen = require('../../app/(auth)/legal').default as React.ComponentType;
/* eslint-enable @typescript-eslint/no-require-imports */

// --- 하네스 (홈 러너와 동일) ---------------------------------------------------

const SCREEN_WIDTH = 390;
const INSETS = {
  frame: { x: 0, y: 0, width: SCREEN_WIDTH, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
const ROOT_MARKER = 'figma-fixture-root';

function Harness({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SafeAreaProvider initialMetrics={INSETS}>
      <ThemeProvider>
        <View testID={ROOT_MARKER} style={{ width: SCREEN_WIDTH }}>
          {children}
        </View>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function findRoot(node: SourceNode): SourceNode | null {
  if (node.isHost && node.props.testID === ROOT_MARKER) return node;
  for (const c of node.children) {
    if (typeof c === 'string') continue;
    const found = findRoot(c);
    if (found) return found;
  }
  return null;
}

interface ScreenFixture {
  id: string;
  name: string;
  element: React.ReactElement;
  /** 렌더 직전 mock 상태 설정 */
  setup: () => void;
  /** 렌더 이후 상태 전이 (슬라이드 이동 등). 캡처 전에 실행된다. */
  after?: (r: RenderResult) => Promise<void>;
}

const resetAuth = (): void => {
  mockStatus = 'signed_out';
  mockLastError = null;
  mockParams = {};
};

const screens: ScreenFixture[] = [
  {
    id: 'screen/login',
    name: '로그인 · 기본',
    element: <LoginScreen />,
    setup: resetAuth,
  },
  {
    id: 'screen/login-authenticating',
    name: '로그인 · 인증 중',
    element: <LoginScreen />,
    setup: () => {
      resetAuth();
      mockStatus = 'authenticating';
    },
  },
  {
    id: 'screen/login-error',
    name: '로그인 · 오류',
    element: <LoginScreen />,
    setup: () => {
      resetAuth();
      // 네트워크 실패 분기 — 화면 하단 에러 안내가 노출된다.
      // lastError는 예외 인스턴스가 아니라 plain 유니온이다 (AuthProvider.ts:41).
      mockLastError = { kind: 'network', message: '네트워크 연결을 확인해주세요.' };
    },
  },
  {
    id: 'screen/onboarding',
    name: '온보딩 · 1번째 슬라이드',
    element: <OnboardingScreen />,
    setup: resetAuth,
  },
  {
    id: 'screen/terms',
    name: '약관 동의',
    element: <TermsScreen />,
    setup: resetAuth,
  },
  {
    id: 'screen/privacy',
    name: '개인정보 처리방침',
    element: <PrivacyScreen />,
    setup: resetAuth,
  },
  {
    id: 'screen/legal-terms',
    name: '법적 고지 · 이용약관',
    element: <LegalScreen />,
    setup: () => {
      resetAuth();
      mockParams = { doc: 'terms' };
    },
  },
];

describe('figma-export 인증 화면 덤프', () => {
  it(`화면 ${screens.length}개를 라이트·다크로 내보낸다`, async () => {
    const artboards: IRArtboard[] = [];
    const warnings: string[] = [];

    for (const theme of ['light', 'dark'] as const) {
      useColorSchemeMock.mockReturnValue(theme);

      for (const screen of screens) {
        screen.setup();
        const r = render(<Harness>{screen.element}</Harness>);
        await act(async () => {});
        if (screen.after) await screen.after(r);

        const marked = findRoot(fromTestInstance(r.UNSAFE_root));
        if (!marked) throw new Error(`${screen.id}: 화면 루트를 찾지 못했습니다.`);

        const result = normalize(marked);
        let root: IRNode = result.root;
        if (root.kind === 'frame' && root.children.length === 1) root = root.children[0] ?? root;
        root.name = screen.name;

        artboards.push({
          id: `${screen.id}/${theme}`,
          group: '인증 화면',
          name: screen.name,
          theme,
          frameWidth: SCREEN_WIDTH,
          root,
        });
        warnings.push(...result.warnings.map((w) => `[${screen.id}/${theme}] ${w}`));
        r.unmount();
      }
    }

    emitPart('screens-auth', { artboards, warnings });

    expect(artboards).toHaveLength(screens.length * 2);
  });
});
