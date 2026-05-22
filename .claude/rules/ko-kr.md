---
description: 한국어 UX, Pretendard, KST 강제. 모든 작업 시 항상 로드.
globs:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/*.md"
  - "**/*.sql"
---

# 한국어 / KST / Locale Rules

→ 결정: [D13 KST 강제](../../docs/DECISIONS.md#d13--kst-강제-db는-timestamptz-utc), [D7 Pretendard](../../docs/DECISIONS.md#d7--typography-pretendard-variable-단일-패밀리-셀프호스팅)

## 절대 규칙

### D13 — KST 강제

- DB = `TIMESTAMPTZ` (UTC 정규화 저장)
- Client = `Asia/Seoul` (luxon 또는 date-fns-tz)
- 시간 그리드 09:00~24:00 = 항상 KST
- 해외 사용자도 모든 시간 KST로 표시 + 작은 라벨 "KST 기준으로 표시 중"
- `new Date()` 직접 사용 금지 (design-guard hook이 차단)
- Edge Function에서도 `Asia/Seoul` 명시

결정 본문 · 예제 (luxon, Edge): [DECISIONS.md#d13](../../docs/DECISIONS.md#d13--kst-강제-db는-timestamptz-utc)

### 한국어 UI

- **모든 UI 라벨·메시지는 한국어** (베타 한국어 only)
- 영문 혼용 금지 ("Loading..." → "불러오는 중...", "OK" → "확인", "Cancel" → "취소")
- 기술 용어도 한국어 우선: "이메일" / "비밀번호" / "프로필"
- 에러 메시지 한국어 + 친절한 톤: "결제를 완료하지 못했어요. 잠시 후 다시 시도해주세요."
- 마이크로카피는 [Q-B12](../../docs/OPEN_QUESTIONS.md#q-b12--f1f7-푸시-알림-마이크로카피) closure 후 일관 적용

### 한국 특화 입력 / 로케일

- **전화번호**: `010-1234-5678` 형식 (자동 dash 삽입)
- **사업자등록번호**: `XXX-XX-XXXXX` 10자리
- **카카오 ID·닉네임**: Unicode 한글 + 특수문자 허용
- **로케일**: `ko-KR` (`Intl.NumberFormat`, `Intl.DateTimeFormat`)
- **통화**: ₩ (`Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' })`) — `₩20,000`

### D7 — Pretendard 셀프호스팅

- 모든 Text에 `Pretendard Variable` (테마 default)
- WOFF2 셀프호스팅 (`assets/fonts/PretendardVariable.woff2`). CDN 금지 (오프라인 첫화면 보호)
- 금지 폰트: Inter, Roboto, Noto Sans (KR/CJK 포함), Apple SD Gothic Neo, Spoqa Han Sans

결정 본문 · fallback chain: [DECISIONS.md#d7](../../docs/DECISIONS.md#d7--typography-pretendard-variable-단일-패밀리-셀프호스팅)

### 한글 텍스트 layout

- 자간 letter-spacing: 타이틀 -0.02em / 본문 0 / 캡션 0.01em
- 줄바꿈: 한국어는 어절 단위 break (`wordWrap: 'break-word'`)
- Tabular nums 필수 위치: 시간 그리드 헤더, 결제 금액, 노쇼 카운터

### 네이버 vs 카카오 표기

- **네이버 지도** (Naver Maps SDK)
- **카카오 로그인 / 카카오 Local API / 카카오톡 / 카카오 알림톡**
- 영문은 backticks 또는 코드 변수명에서만: `@mj-studio/react-native-naver-map`

## 베타 → 정식 확장 시

- 영문 i18n 인프라는 차기 버전 (현재 단일 locale `ko-KR`)
- 코드 구조는 i18n-ready로: 라벨을 `messages.ts`에 모으는 패턴 권고

## 금지 패턴

- `new Date()` 직접 사용 (KST 미명시)
- 영문 UI 라벨 (베타 한국어 only)
- 영문 fallback 폰트 단독 (Pretendard 필수)
- CDN 폰트 로딩
- 한국어 자간 무시한 영문 디폴트 letter-spacing
