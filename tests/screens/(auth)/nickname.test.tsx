// 닉네임 설정/변경 화면.
// 스펙: docs/superpowers/specs/2026-07-29-nickname-design.md §7.
//
// 한 화면이 두 모드를 겸한다 — 모드는 세션의 nicknameSetAt에서 파생된다:
//   null  → 가입 모드 (뒤로 없음, "확인", 성공 시 온보딩으로 replace)
//   값 있음 → 수정 모드 (뒤로 있음, "저장", 성공 시 back)
// 모드를 prop이나 라우트 파라미터로 받으면 게이트 판단과 화면 상태가 어긋날 수 있다.

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import NicknameScreen from '../../../app/(auth)/nickname';
import { ThemeProvider } from '@/design/theme';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockReplace(...args),
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

const mockSetMyNickname = jest.fn();
jest.mock('@/lib/profile/api', () => ({
  setMyNickname: (...args: unknown[]) => mockSetMyNickname(...args),
}));

const mockApplyNickname = jest.fn();
let mockSessionUser: { nickname: string; nicknameSetAt?: string | null } = {
  nickname: '카톡이름',
  nicknameSetAt: null,
};

jest.mock('@/lib/auth/setup', () => ({
  authStore: { getState: () => ({ applyNickname: mockApplyNickname }) },
  useAuth: (selector: (s: unknown) => unknown) => selector({ session: { user: mockSessionUser } }),
}));

const mockToast = jest.fn();
jest.mock('@/components/Toast', () => ({
  useToast: () => ({ show: mockToast }),
}));

const wrapper = ThemeProvider;

beforeEach(() => {
  jest.clearAllMocks();
  mockSessionUser = { nickname: '카톡이름', nicknameSetAt: null };
  mockSetMyNickname.mockResolvedValue({ ok: true, value: '민수' });
});

describe('NicknameScreen — 가입 모드 (nicknameSetAt null)', () => {
  test('카톡 이름을 프리필한다 (지우고 시작하지 않아도 됨)', () => {
    const { getByTestId } = render(<NicknameScreen />, { wrapper });
    expect(getByTestId('nickname-input').props.value).toBe('카톡이름');
  });

  test('가입 카피 + "확인" CTA', () => {
    const { getByText, getByLabelText } = render(<NicknameScreen />, { wrapper });
    expect(getByText('어떤 이름으로 부를까요?')).toBeTruthy();
    expect(getByText('친구들이 이 이름으로 회원님을 찾아요')).toBeTruthy();
    expect(getByLabelText('확인')).toBeTruthy();
  });

  test('뒤로 가기가 없다 (건너뛸 수 없는 단계)', () => {
    const { queryByLabelText } = render(<NicknameScreen />, { wrapper });
    expect(queryByLabelText('뒤로 가기')).toBeNull();
  });

  test('성공 → applyNickname + 온보딩으로 replace', async () => {
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '민수');
    fireEvent.press(getByLabelText('확인'));

    await waitFor(() => expect(mockSetMyNickname).toHaveBeenCalledWith('민수'));
    expect(mockApplyNickname).toHaveBeenCalledWith('민수');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });

  test('가입 모드에서는 성공 토스트를 띄우지 않는다 (곧바로 화면 전환)', async () => {
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '민수');
    fireEvent.press(getByLabelText('확인'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockToast).not.toHaveBeenCalled();
  });
});

describe('NicknameScreen — 수정 모드 (nicknameSetAt 있음)', () => {
  beforeEach(() => {
    mockSessionUser = { nickname: '기존이름', nicknameSetAt: '2026-07-29T00:00:00Z' };
  });

  test('현재 닉네임 프리필 + "저장" CTA + 뒤로 가기', () => {
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    expect(getByTestId('nickname-input').props.value).toBe('기존이름');
    expect(getByLabelText('저장')).toBeTruthy();
    expect(getByLabelText('뒤로 가기')).toBeTruthy();
  });

  test('성공 → 토스트 + back', async () => {
    mockSetMyNickname.mockResolvedValue({ ok: true, value: '바꾼이름' });
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '바꾼이름');
    fireEvent.press(getByLabelText('저장'));

    await waitFor(() => expect(mockApplyNickname).toHaveBeenCalledWith('바꾼이름'));
    expect(mockToast).toHaveBeenCalledWith({ message: '닉네임을 바꿨어요!', variant: 'default' });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('NicknameScreen — 검증과 실패', () => {
  test('규칙 위반이면 CTA가 비활성 (누르기 전에 알 수 있다)', () => {
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '가');

    expect(getByLabelText('확인').props.accessibilityState?.disabled).toBe(true);
  });

  test('입력 중에는 에러를 띄우지 않는다 (타이핑 중 빨간 글씨 방지)', () => {
    const { getByTestId, queryByText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '가');

    expect(queryByText('2자 이상 입력해주세요')).toBeNull();
  });

  test('비활성 CTA를 눌러도 RPC를 때리지 않는다', () => {
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '가');
    fireEvent.press(getByLabelText('확인'));

    expect(mockSetMyNickname).not.toHaveBeenCalled();
  });

  test('중복 → 사유별 카피를 그대로 노출 (일반 카피로 덮이지 않는다)', async () => {
    mockSetMyNickname.mockResolvedValue({ ok: false, reason: 'taken' });
    const { getByTestId, getByLabelText, getByText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '민수');
    fireEvent.press(getByLabelText('확인'));

    await waitFor(() => expect(getByText('이미 사용 중인 닉네임이에요')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('중복 에러 후 다시 입력하면 에러가 사라진다', async () => {
    mockSetMyNickname.mockResolvedValue({ ok: false, reason: 'taken' });
    const { getByTestId, getByLabelText, getByText, queryByText } = render(<NicknameScreen />, {
      wrapper,
    });
    fireEvent.changeText(getByTestId('nickname-input'), '민수');
    fireEvent.press(getByLabelText('확인'));
    await waitFor(() => expect(getByText('이미 사용 중인 닉네임이에요')).toBeTruthy());

    fireEvent.changeText(getByTestId('nickname-input'), '민수2');

    expect(queryByText('이미 사용 중인 닉네임이에요')).toBeNull();
  });

  test('예상 밖 실패 → 토스트 + CTA 재활성 (영구 잠금 없음)', async () => {
    mockSetMyNickname.mockRejectedValue(new Error('저장하지 못했어요. 다시 시도해볼게요.'));
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '민수');
    fireEvent.press(getByLabelText('확인'));

    await waitFor(() => expect(mockToast).toHaveBeenCalled());
    expect(getByLabelText('확인').props.accessibilityState?.disabled).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  test('연타해도 RPC는 1회 (중복 요청 차단)', async () => {
    let resolve: (v: unknown) => void = () => {};
    mockSetMyNickname.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { getByTestId, getByLabelText } = render(<NicknameScreen />, { wrapper });
    fireEvent.changeText(getByTestId('nickname-input'), '민수');

    fireEvent.press(getByLabelText('확인'));
    fireEvent.press(getByLabelText('확인'));
    fireEvent.press(getByLabelText('확인'));

    expect(mockSetMyNickname).toHaveBeenCalledTimes(1);
    resolve({ ok: true, value: '민수' });
    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  });
});
