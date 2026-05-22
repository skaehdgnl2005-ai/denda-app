---
name: design-check
description: DESIGN.md 토큰 대조 체크리스트. UI 컴포넌트·화면 마무리 시 호출. 색·폰트·간격·모션·접근성 정합성 검증.
---

# /design-check

UI 코드가 [DESIGN.md](../../../docs/DESIGN.md) 토큰을 따르는지 체크리스트 검증.

design-guard hook이 명백한 위반(그라데이션·hex·`Date()` 등)을 자동 차단하지만, 이 스킬은 **사람이 놓치기 쉬운 의미적 위반**을 잡는다.

## 사용 시점

- UI 컴포넌트 구현 완료 직후 (`/ship-task` 전)
- 디자인 변경이 큰 PR 작성 전
- 다크모드 동작 검증 시
- 새 화면 신규 작성 시

## 체크리스트

### 색 (6항목)

- [ ] hex 직접 작성 안 함 → 모두 `tokens.light.brand[N]` 또는 `tokens.dark.*` 참조
- [ ] 보라(brand-500)는 의미 있을 때만 (CTA·제휴·heat-4·확정) — 장식 보라 없음
- [ ] 시맨틱 컬러(success/warning/error/info)는 의미 일관
- [ ] 라이트/다크 두 모드 모두 동등 — 다크가 단순 색 반전 X
- [ ] indigo 컬러 없음 (Tailwind `indigo-*`)
- [ ] heat-0 = 중립 그레이(surface-3), 본인 선택은 brand-50 + 보더 (충돌 X)

### 폰트 (4항목)

- [ ] Pretendard Variable 단일 패밀리
- [ ] 금지 폰트 없음 (Inter, Roboto, Noto Sans, Apple SD Gothic Neo, Spoqa Han Sans)
- [ ] Tabular nums 필수 위치 (시간 그리드 헤더, 결제 금액, 노쇼 카운터, 멤버 수)
- [ ] Type scale 토큰 (`display`, `title-1` ~ `micro`, `button`)만 사용 — 임의 size 없음

### 간격 (5항목)

- [ ] 4pt 그리드만 (`space-0` ~ `space-20`). 임의 값(7px, 13px) 없음
- [ ] 화면 좌우 inset = `space-4` (16pt)
- [ ] 카드 padding = `space-4`
- [ ] 섹션 vertical = `space-6` (24pt)
- [ ] 터치 타깃 ≥ 44pt × 44pt (`hitSlop` 활용)

### 곡률 (2항목)

- [ ] 한 화면에 ≤ 3개의 radius (보통 `radius-md` + `radius-full`)
- [ ] FAB는 `radius-md` (둥근 사각형, 원형 X)

### 모션 (3항목)

- [ ] Duration · easing 토큰만 사용
- [ ] 시간 그리드 드래그 spring `{ damping: 18, stiffness: 200, mass: 1 }`
- [ ] `AccessibilityInfo.isReduceMotionEnabled()` 응답 처리

### 그림자 / Elevation (1항목)

- [ ] e0~e4만 사용 (라이트는 shadow, 다크는 surface 색 + 보더)

### 아이콘 (2항목)

- [ ] Lucide 2px stroke만 (`lucide-react-native`)
- [ ] 6개 커스텀 외 SVG 추가 없음 (브랜드/제휴 마커/FAB/히트맵 칩/노쇼/환불)

### 접근성 (5항목)

- [ ] 모든 interactive 컴포넌트에 `accessibilityLabel` + `accessibilityRole`
- [ ] 본문 contrast ≥ 4.5:1, 타이틀 ≥ 3:1 (Lighthouse 또는 수동)
- [ ] 시맨틱 컬러 + 아이콘 동반 (색 단독 의존 X)
- [ ] 동적 타입 응답 (`allowFontScaling` 명시)
- [ ] 시간 그리드 셀 라벨 — "5월 22일 19시 30분, 3명 가능, 더블탭으로 선택"

### 상태 (3항목)

- [ ] 빈 상태 — 이미지 + 1줄 헤드라인 + 1줄 보조 + primary CTA (DESIGN §11.2)
- [ ] 로딩 — skeleton 또는 spinner (선택 spec)
- [ ] 에러 — 인라인 / 배너 / 모달 중 심각도에 맞는 패턴 (시스템 알럿 X)

### 다크모드 (2항목)

- [ ] 시스템 자동 ON만 (수동 토글 X)
- [ ] 다크 디테일(마커·차트·맵)은 deferred OK — 토큰 정의만 검증

## 검증 방법

### 자동
- `npx tsc --noEmit` (타입)
- `npx eslint` (lint rule)
- design-guard hook (편집 시 자동)

### 수동
- 라이트/다크 두 모드에서 시각 확인 (Expo Go 또는 EAS dev build)
- iPhone SE 2nd (320pt) 시뮬레이터에서 깨짐 없는지
- iPhone Pro Max (430pt)에서 stretched 느낌 없는지
- 동적 타입 130% 켜고 타이틀 클램프 동작

## 위반 발견 시

1. 위반 항목 사용자에게 보고
2. 수정 제안 (어떤 토큰으로 바꿔야 하는지)
3. 사용자 확인 후 수정
4. 토큰에 없는 새 가치가 필요하면 → [DECISIONS.md](../../../docs/DECISIONS.md)에 새 D{N} + DESIGN.md §16 결정 로그에 추가 후 반영 (사용자 승인 필수)

## 자주 놓치는 위반 패턴

- 라이트 모드에 brand-300 이하를 본문 색으로 (contrast 부족)
- 다크 모드에 text-tertiary를 본격 표시에 (contrast 부족)
- FAB를 원형으로 (DESIGN §10.7 — 둥근 사각형 `radius-md`)
- 히트맵 heat-0을 brand-50으로 (본인 선택과 충돌)
- 그리드 셀 hit area 시각 크기와 동일 (44pt 미달)
- 영문 라벨 (한국어 일관성 — rules/ko-kr.md)
- `new Date()` 직접 (KST 미명시)
