import { decideGate, type GateInput } from './gate';

function makeInput(overrides: Partial<GateInput> = {}): GateInput {
  return {
    status: 'signed_in',
    hasAgreedToTerms: true,
    hasCompletedOnboarding: true,
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
