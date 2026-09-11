// 회귀 가드 — 루트 레이아웃 GestureHandlerRootView 필수 (D12 시간 그리드 운명).
//
// 왜 구조적(소스) 테스트인가:
//   react-native-gesture-handler v2는 앱 루트가 <GestureHandlerRootView>로 감싸져야
//   Android에서 모든 제스처(시간 그리드 sweep Pan, 지도 Pan)가 동작한다. expo-router
//   (main: expo-router/entry)는 이를 자동 주입하지 않으므로 app/_layout.tsx가 직접 감싸야 한다.
//
//   이 누락은 실기기에서만 "드래그·탭 전부 무반응, 투표 기능 부재"로 드러난다. Jest는
//   jest.setup.js에서 GestureHandlerRootView를 plain View로, GestureDetector를 children
//   통과로 mock하기 때문에 제스처 *로직* 단위 테스트(useSweepGesture.test/Grid.test)는
//   루트 래퍼가 없어도 전부 통과한다 — mock이 통합 갭을 가린다. 따라서 "루트에 GHRV가
//   실제로 존재하는가"는 소스 구조로만 검증할 수 있다.

import { readFileSync } from 'fs';
import { join } from 'path';

const layoutSource = readFileSync(join(__dirname, '../../app/_layout.tsx'), 'utf8');

describe('app/_layout.tsx — GestureHandlerRootView (D12 회귀 가드)', () => {
  it('react-native-gesture-handler에서 GestureHandlerRootView를 import한다', () => {
    expect(layoutSource).toMatch(
      /import\s*\{[^}]*\bGestureHandlerRootView\b[^}]*\}\s*from\s*['"]react-native-gesture-handler['"]/,
    );
  });

  it('GestureHandlerRootView가 트리 최외곽(SafeAreaProvider 바깥)을 감싼다', () => {
    const ghrvIndex = layoutSource.indexOf('<GestureHandlerRootView');
    const safeAreaIndex = layoutSource.indexOf('<SafeAreaProvider');

    expect(ghrvIndex).toBeGreaterThanOrEqual(0);
    expect(safeAreaIndex).toBeGreaterThanOrEqual(0);
    // 최외곽이어야 모든 라우트(그리드·지도)의 제스처가 살아난다.
    expect(ghrvIndex).toBeLessThan(safeAreaIndex);
  });

  it('GestureHandlerRootView가 flex:1로 전체 영역을 차지한다 (0높이 붕괴 방지)', () => {
    // flex 없는 GHRV는 0pt로 접혀 터치가 통과되지 않는 흔한 실수.
    expect(layoutSource).toMatch(/<GestureHandlerRootView[^>]*flex:\s*1/);
  });
});
