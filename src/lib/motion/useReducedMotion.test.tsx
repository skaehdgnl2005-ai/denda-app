import { AccessibilityInfo } from 'react-native';
import { renderHook, waitFor, act } from '@testing-library/react-native';

import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion (§6.4 단일 분기점)', () => {
  test('기본값은 false — 모션 켜짐 (설정 조회 전)', () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(
      new Promise(() => {}), // never resolves — 초기값 확인
    );
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  test('모션 감소 설정이 켜져 있으면 true를 반환한다', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, 'addEventListener')
      .mockReturnValue({ remove: jest.fn() } as never);

    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(true));
  });

  test('reduceMotionChanged 이벤트로 실시간 갱신된다', async () => {
    let listener: ((v: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      cb: (v: boolean) => void,
    ) => {
      listener = cb;
      return { remove: jest.fn() };
    }) as never);

    const { result } = renderHook(() => useReducedMotion());
    await waitFor(() => expect(result.current).toBe(false));
    act(() => listener?.(true));
    expect(result.current).toBe(true);
  });

  test('언마운트 시 subscription을 정리한다', () => {
    const remove = jest.fn();
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockReturnValue({ remove } as never);

    const { unmount } = renderHook(() => useReducedMotion());
    expect(() => unmount()).not.toThrow();
    expect(remove).toHaveBeenCalled();
  });
});
