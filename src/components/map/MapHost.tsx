// 지도 렌더 단일 경계 (D38).
//
// 네이티브 분기는 오직 여기 한 곳. isMapAvailable()===true 일 때만 NaverMapScene을
// lazy 로드(D25) — dev/테스트에서는 false라 동적 import가 실행되지 않아 네이티브 미설치도
// 안전하다. 화면은 순수 MapScene만 만들어 넘긴다. 키 도착 시 코드 변경 없이 점등.

import { lazy, Suspense, type ReactNode } from 'react';

import { isMapAvailable } from '@/lib/map/mapAvailability';
import type { MapScene } from '@/lib/map/mapScene';

import { MapLoading } from './MapLoading';
import { MapPlaceholder } from './MapPlaceholder';

const NaverMapScene = lazy(() => import('./NaverMapScene'));

interface MapHostProps {
  scene: MapScene;
  /** 미제공 시 기본 MapPlaceholder(mode). 화면이 "리스트로 보기" 유도를 주입할 수 있다. */
  fallback?: ReactNode;
}

export function MapHost({ scene, fallback }: MapHostProps): React.JSX.Element {
  if (!isMapAvailable()) {
    return <>{fallback ?? <MapPlaceholder mode={scene.mode} />}</>;
  }
  return (
    <Suspense fallback={<MapLoading />}>
      <NaverMapScene scene={scene} />
    </Suspense>
  );
}
