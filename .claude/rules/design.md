---
description: DESIGN.md 토큰 강제 — 색·폰트·간격·곡률·모션·접근성. UI 작업 시 자동 로드.
globs:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "src/**/*.css"
  - "src/design/**"
  - "src/components/**"
  - "src/screens/**"
  - "web-guest/**/*.tsx"
  - "web-guest/**/*.css"
---

# Design Rules — DESIGN.md 토큰 강제

→ 단일 진실: [docs/DESIGN.md](../../docs/DESIGN.md)

## 절대 규칙 (위반 시 design-guard hook이 차단)

### 색
- **hex 직접 작성 금지** → 항상 `tokens.light.brand[500]` 형태로 참조
- **그라데이션 금지** (Tailwind `bg-gradient-to-*`, `from-*`, CSS `linear-gradient`) → [D4 토스 풍 절제](../../docs/DECISIONS.md#d4--디자인-원칙-토스-풍-절제)
- **글래스모피즘 금지** (`backdrop-filter`, `backdrop-blur`, `bg-white/N`)
- **보라(#7C3AED, brand-500)는 의미 있을 때만**: CTA / 제휴 강조 / heat-4 / 모임 확정. 장식 보라 금지 → [D5 Purple Discipline](../../docs/DECISIONS.md#d5--purple-discipline)
- **indigo 컬러 금지** (Tailwind `indigo-*`, `bg-indigo`, `text-indigo`). 보라는 brand-500만

### 폰트
- **Pretendard Variable 단일 패밀리**. 셀프호스팅 WOFF2. CDN 의존 금지 → [D7](../../docs/DECISIONS.md#d7--typography-pretendard-variable-단일-패밀리-셀프호스팅)
- **금지 폰트**: Inter, Roboto, Noto Sans (KR/CJK 포함), Apple SD Gothic Neo, Spoqa Han Sans
- Tabular nums 필수 위치: 시간 그리드 헤더, 결제 금액, 노쇼 카운터, 멤버 수
- `fontVariant: ['tabular-nums']` 명시

### 간격 (4pt 그리드)
- **임의 값 금지** (7px, 13px 등). `tokens.space[N]`에서 선택
- 화면 좌우 inset = `space-4` (16pt)
- 카드 padding = `space-4`
- 섹션 vertical = `space-6` (24pt)
- 컴포넌트 내부 = `space-2` (8pt)
- **터치 타깃 최소 44pt × 44pt** (시각 크기와 별개, `hitSlop`으로 확장)

### 곡률
- `radius-md` (8pt) 기본. `radius-full`은 아바타·pill
- 한 화면에 4가지 이상 radius 사용 금지

### 모션
- Duration · easing은 `tokens.duration.*` + `tokens.easing.*`만
- 시간 그리드 드래그: Reanimated spring `{ damping: 18, stiffness: 200, mass: 1 }`
- 모션 감소(`AccessibilityInfo.isReduceMotionEnabled()`) 응답 의무
- `duration-x-long` (600ms) = 축하 모먼트만 (heat-4 셀이 차오를 때)

### 다크모드
- **시스템 자동만**. 수동 토글 금지 (Phase 1+2) → [D6](../../docs/DECISIONS.md#d6--다크모드--시스템-자동-독립-디자인)
- 라이트의 색 반전 금지. 독립 디자인 (DESIGN §3.2의 별도 토큰)
- 두 모드 동등 품질 검증 (특히 contrast 4.5:1 본문, 3:1 큰 텍스트)

### 히트맵
- 5-stop ramp (heat-0~4) — [D10](../../docs/DECISIONS.md#d10--히트맵-5단계-색-램프-heat-0--중립-그레이)
- **heat-0 = 중립 그레이** (surface-3), 옅은 보라(brand-50) 금지
- 본인 선택 = ramp가 아닌 별도 시각 (보라 보더 2pt + brand-50 fill)
- 색 단독 의존 금지 → 카운트 라벨 동반 (a11y 색맹)

### 아이콘
- **Lucide 2px stroke 기본** (`lucide-react-native`)
- 1px / 3px stroke 금지
- 5개 커스텀만 허용 (브랜드 마크, FAB 글리프, 히트맵 칩, 노쇼 뱃지, 환불 핀) — 제휴/지도 마커는 PNG 아닌 `MapMarkerView` 코드 뷰(brand-500 + 흰 stroke, [D40](../../docs/DECISIONS.md#d40--지도-마커--navermapmarkeroverlay-children-커스텀-뷰-png-래스터-대체))
- 이모지 디자인 요소 금지 (시스템 이모지는 사용자 콘텐츠로만)
- 컬러 일러스트 아이콘 금지 (line-only 또는 단색 fill만)

### 접근성
- 모든 본문 ≥ 4.5:1 contrast, 타이틀 ≥ 3:1
- 시맨틱 컬러는 색 단독 의존 금지 → 항상 아이콘 동반
- 모든 상호작용 컴포넌트에 `accessibilityLabel` + `accessibilityRole` 필수
- 모션 감소·동적 타입 응답 의무

## 컴포넌트 spec 빠른 참조

| 컴포넌트 | DESIGN.md 위치 |
|---|---|
| 시간 그리드 셀 | §10.1 |
| 제휴 마커 | §10.2 |
| 예약 바텀시트 | §10.3 |
| 결제 상태 카드 | §10.4 |
| 동선 폴리라인 | §10.5 |
| FAB | §10.7 |
| 빈 상태 | §11.2 |
| 에러 | §11.3 |

## 새 시각 결정이 필요할 때

1. DESIGN.md를 먼저 확인 (대부분 이미 정의됨)
2. 정말 없으면 사용자 승인 받고 [DECISIONS.md](../../docs/DECISIONS.md)에 새 D{N} 추가 + DESIGN.md §16 결정 로그에 PR/메모 링크
3. 임의 토큰 추가는 금지 (4pt 그리드·5-stop ramp 등 스케일 깨짐)
