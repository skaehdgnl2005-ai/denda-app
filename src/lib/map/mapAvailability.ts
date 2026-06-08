// 지도 활성화 게이트 (D38).
//
// 네이티브 지도 렌더는 (1) 네이버 Maps Client ID 발급 + (2) EAS 네이티브 빌드가 모두 있어야
// 켜진다. 이 함수가 단일 판정점 — true일 때만 MapHost가 NaverMapScene을 lazy 로드한다.
// EXPO_PUBLIC_*는 정적 멤버 접근(빌드 시 인라인)으로 읽고, 테스트는 env 주입으로 검증한다.

export interface MapEnv {
  enabled: boolean;
  clientId: string;
}

/** .env.example의 placeholder 값 — 실제 키로 교체되기 전엔 지도 비활성. */
const NAVER_CLIENT_ID_PLACEHOLDER = 'your-naver-client-id';

function getMapEnv(): MapEnv {
  return {
    enabled: process.env.EXPO_PUBLIC_MAP_ENABLED === 'true',
    clientId: process.env.EXPO_PUBLIC_NAVER_MAP_CLIENT_ID ?? '',
  };
}

export function isMapAvailable(env: MapEnv = getMapEnv()): boolean {
  return env.enabled && env.clientId.length > 0 && env.clientId !== NAVER_CLIENT_ID_PLACEHOLDER;
}
