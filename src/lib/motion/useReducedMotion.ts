// 모션 감소(Reduce Motion) 단일 분기점 (DESIGN §6.4 / §12.5).
// 이 훅이 true면 컴포넌트는 duration-medium↑ 모션을 micro로, spring을 fade로,
// x-long 축하 모션을 단순 색 전환으로 낮춘다. 무한 루프 애니메이션은 정적 표시로 전환.
//
// Reanimated의 useReducedMotion 대신 RN AccessibilityInfo를 쓰는 이유: 워클릿 런타임
// 없이도 동작하고(테스트 가능), 시스템 설정 변경을 실시간 구독할 수 있다.
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduced(enabled);
      })
      .catch(() => {
        /* 조회 실패 시 모션 유지(false) — 안전한 기본값 */
      });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled: boolean) => {
      setReduced(enabled);
    });

    return (): void => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
