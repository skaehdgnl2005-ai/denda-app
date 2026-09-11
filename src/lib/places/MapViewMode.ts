// S15-mapmode-logic — 지도탭 모드 분기 spec (scaffold).
//
// search: 장소 검색 결과 마커 (S10 — `useMapSearch` 결과를 마커로).
// schedule: 모임 일정 좌표 + ①②③ 숫자 배지 + 폴리라인 (S15 — `scheduleMapPoint` + `polyline`).
// midpoint: 멤버 출발지 + 중간지점 마커 (S-MAP M3 — `toMidpointScene`).
//
// 본 모듈은 type alias만. 모드 전환 UI(캘린더 토글)·native MapView 렌더는 EAS Build 운영 트랙
// 시점에 wire-up (S10 native 렌더와 동일 패턴). 그때 `<MapView mode="search"|"schedule">` props로
// 분기하며 마커 set 교체 + 폴리라인 toggle만 수행한다.

export type MapViewMode = 'search' | 'schedule' | 'midpoint';
