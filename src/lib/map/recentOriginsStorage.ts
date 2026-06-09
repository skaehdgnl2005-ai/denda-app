// S-MAP M3 — 최근 출발지 프로덕션 저장소 어댑터 (expo-secure-store).
//
// recentOrigins.ts는 DI(RecentOriginsStorage)라 jest에서 native 없이 테스트된다. 본 파일만
// expo-secure-store를 실제 import — 화면(midpoint.tsx)이 이 어댑터를 주입한다. (auth/setup.ts
// 와 같은 분리 패턴: native import는 비테스트 모듈에 격리.)

import * as SecureStore from 'expo-secure-store';

import type { RecentOriginsStorage } from './recentOrigins';

export const recentOriginsStorage: RecentOriginsStorage = {
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
};
