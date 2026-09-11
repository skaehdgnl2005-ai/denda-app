import { decideGate, type GateInput } from './gate';

function makeInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    status: 'signed_in',
    hasAgreedToTerms: true,
    hasCompletedOnboarding: true,
    nicknameSetAt: '2026-07-29T00:00:00Z',
    ...overrides,
  };
}

describe('decideGate', () => {
  it('initializing → splash', () => {
    expect(decideGate(makeInput({ status: 'initializing' }))).toEqual({ kind: 'splash' });
  });

  it('signed_out → login', () => {
    expect(decideGate(makeInput({ status: 'signed_out' }))).toEqual({ kind: 'login' });
  });

  it('authenticating → login (인증 중에도 login 화면에 머문다)', () => {
    expect(decideGate(makeInput({ status: 'authenticating' }))).toEqual({ kind: 'login' });
  });

  it('signed_in + !terms → terms', () => {
    expect(decideGate(makeInput({ hasAgreedToTerms: false }))).toEqual({ kind: 'terms' });
  });

  it('signed_in + terms + !onboarded → onboarding', () => {
    expect(decideGate(makeInput({ hasCompletedOnboarding: false }))).toEqual({
      kind: 'onboarding',
    });
  });

  // --- 닉네임 단계 (2026-07-29 스펙 §6) ---------------------------------------
  // nicknameSetAt 3-상태: string=정함 / null=미설정 / undefined=아직 모름.

  it('nicknameSetAt null → nickname (아직 카톡 이름 그대로)', () => {
    expect(decideGate(makeInput({ nicknameSetAt: null }))).toEqual({ kind: 'nickname' });
  });

  it('nicknameSetAt undefined → 닉네임 단계 건너뜀 (판단 보류)', () => {
    // 콜드 스타트에서 프로필 조회가 끝나기 전. "모름"을 "미설정"으로 오인하면
    // 앱을 켤 때마다 닉네임 화면이 번쩍인다.
    expect(decideGate(makeInput({ nicknameSetAt: undefined }))).toEqual({ kind: 'home' });
  });

  it('약관 미동의가 닉네임보다 우선 (법적 선행)', () => {
    expect(decideGate(makeInput({ hasAgreedToTerms: false, nicknameSetAt: null }))).toEqual({
      kind: 'terms',
    });
  });

  it('닉네임이 온보딩보다 우선', () => {
    expect(decideGate(makeInput({ nicknameSetAt: null, hasCompletedOnboarding: false }))).toEqual({
      kind: 'nickname',
    });
  });

  it('닉네임 미설정이어도 signed_out이면 login 우선', () => {
    expect(decideGate(makeInput({ status: 'signed_out', nicknameSetAt: null }))).toEqual({
      kind: 'login',
    });
  });

  it('닉네임 설정 완료 + 온보딩 미완료 → onboarding', () => {
    expect(
      decideGate(
        makeInput({ nicknameSetAt: '2026-07-29T00:00:00Z', hasCompletedOnboarding: false }),
      ),
    ).toEqual({ kind: 'onboarding' });
  });

  it('signed_in + terms + onboarded → home', () => {
    expect(decideGate(makeInput())).toEqual({ kind: 'home' });
  });

  it('약관/온보딩 플래그는 signed_out 상태에선 무시 (login 우선)', () => {
    expect(
      decideGate(
        makeInput({
          status: 'signed_out',
          hasAgreedToTerms: true,
          hasCompletedOnboarding: true,
        }),
      ),
    ).toEqual({ kind: 'login' });
  });
});
