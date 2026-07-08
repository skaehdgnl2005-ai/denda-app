# 된다 (DenDa) — Design System

> **버전**: v1.0 (베타 출시)
> **작성일**: 2026-05-21
> **상태**: 확정 — 모든 UI/시각 결정은 이 문서를 따른다
> **출처**: V2_PRD.md §10 확장 + /design-consultation 합의

이 문서는 된다의 단일 시각·인터랙션 진실 공급원이다. 컴포넌트, 색, 타이포, 간격, 모션, 그림자, 아이콘 — 모든 시각 결정은 여기서 출발한다. 임의 변경 금지. 명시적 사용자 승인 후 §10 결정 로그에 기록.

---

## §0. 디자인 원칙

1. **토스 풍 절제** — 표현은 타이포 위계·여백·곡률로. 그라데이션·글래스모피즘·장식 패턴 금지.
2. **무게 있는 보라** — 보라(#7C3AED)는 의미가 있을 때만 쓴다. CTA, 제휴 강조, 히트맵 최고치, 모임 확정. 장식 보라 금지.
3. **시스템 자동 다크모드** — 두 모드 모두 동등하게 디자인되어야 한다. 다크는 라이트의 색 반전이 아니라 독립 디자인.
4. **태블릿 없음, 데스크톱 없음** — 모바일 320~430pt 폭만 지원. 모든 컴포넌트는 SE급(320pt)에서 깨지지 않는다.
5. **접근성은 사양** — 44pt 터치 타깃, WCAG AA 대비, 동적 텍스트 크기, 모션 감소 응답은 옵션이 아니다.
6. **모든 상태가 디자인** — 로딩·빈·에러·부분 상태는 해피패스와 동등하게 명시된다. "데이터 없음" 폴백은 디자인 실패다.

---

## §1. 제품 컨텍스트

- **무엇**: 친구들과 시간 맞추고 장소 정하고 예약까지 한 번에. 소셜 스케줄링 + 예약 모바일 앱.
- **누구를 위해**: 한국 대학생 팀플 · 직장인 회식 · 동호회 호스트 (P1·P2 페르소나).
- **공간**: 시간 맞추기(When2meet/카톡 투표) × 예약(캐치테이블/테이블링) 교차. 카테고리에 없는 end-to-end.
- **시각 앵커**: 토스(절제·고대비·여백)와 Linear(밀도·정밀). 슈퍼휴먼·노션 아님.
- **기억해야 할 한 가지**: "친구들과 시간 정하는 게 30초로 줄어드는, 차분하고 정확한 도구."

---

## §2. 타이포그래피

### 2.1. 패밀리 — Pretendard Variable

```
font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

- **단일 패밀리**: Pretendard Variable. 폴백은 OS 기본 한글 폰트.
- **이유**: 한국어 + Latin + 숫자가 한 패밀리에서 일관되게 렌더링되는 사실상 표준. 가변 폰트라 weight 100~900 연속 (번들 사이즈 1개 파일).
- **로딩**: `expo-font` + `Pretendard-Variable.woff2` (or `.otf`) 셀프호스팅. CDN 의존 금지 (오프라인 환경 첫화면 렌더 보호).
- **금지**: System font fallback 단독, Inter, Noto Sans KR, Apple SD Gothic Neo (브랜드 일관성), Spoqa Han Sans (구버전).

### 2.2. 타입 스케일 (4pt 라인 높이 정렬)

| 토큰         | 크기 / 라인 | weight | 용도                                  |
|--------------|-------------|--------|---------------------------------------|
| `display`    | 32 / 40     | 700    | 온보딩 슬라이드 헤드라인, 마케팅 히어로 |
| `title-1`    | 24 / 32     | 700    | 화면 타이틀 (모임 이름, 프로필명)      |
| `title-2`    | 20 / 28     | 600    | 섹션 타이틀 (홈 "다가오는 일정")       |
| `title-3`    | 18 / 24     | 600    | 카드 타이틀, 모달 헤더                 |
| `body`       | 16 / 24     | 400    | 본문 기본                              |
| `body-bold`  | 16 / 24     | 600    | 본문 강조 (선택된 친구 이름 등)        |
| `body-sm`    | 14 / 20     | 400    | 보조 본문, 캡션 헤더                   |
| `body-sm-bold` | 14 / 20   | 600    | 보조 본문 강조                         |
| `caption`    | 13 / 18     | 500    | 메타데이터 (시간, 위치)                |
| `micro`      | 11 / 16     | 500    | 뱃지, 인디케이터, 작은 라벨            |
| `button`     | 16 / 20     | 600    | 버튼 라벨 (라인 높이 압축)             |

### 2.3. 숫자 변형

`tabular-nums`는 다음 위치에서 **반드시** 적용:
- 시간 그리드 헤더 (09:00 / 10:00 정렬)
- 결제 금액 (₩20,000)
- 노쇼 카운터, 정산 금액
- 멤버 수 카운터

React Native 적용:
```ts
<Text style={{ fontVariant: ['tabular-nums'] }}>09:00</Text>
```

### 2.4. 한글 자간 (letter-spacing)

- `title-*`: -0.02em (한글 타이틀은 약간 좁힘)
- `body-*`: 0 (기본)
- `caption`, `micro`: 0.01em (작은 텍스트는 약간 넓힘, 가독성)
- 영문 전용 (이메일 등): 0

---

## §3. 색

### 3.1. 라이트 모드 토큰

#### 브랜드
```
brand-50:   #F5F3FF   매우 옅은 보라 — 선택된 그리드 셀 배경, 카드 hover
brand-100:  #EDE9FE   옅은 보라 — 선택된 슬롯, subtle 강조
brand-200:  #DDD6FE
brand-300:  #C4B5FD   히트맵 ramp 2
brand-400:  #A78BFA   secondary 액션, 호버
brand-500:  #7C3AED   **메인 브랜드** — CTA, 제휴 마커, 확정 상태
brand-600:  #6D28D9   pressed/active
brand-700:  #5B21B6   diffused, rare
```

#### 표면 (Surface)
```
surface-0:   #FFFFFF   페이지 배경
surface-1:   #FFFFFF   카드 (구분은 border + shadow로)
surface-2:   #F9FAFB   elevated 카드, 그룹 컨테이너 배경
surface-3:   #F3F4F6   pressed 상태, disabled 배경
```

#### 보더
```
border-subtle:  #E5E7EB   기본 divider, 카드 보더
border-strong:  #D1D5DB   active input 보더, 강한 구분
border-focus:   #7C3AED   포커스 링 (브랜드와 동일)
```

#### 텍스트
```
text-primary:    #111827   기본 본문, 타이틀
text-secondary:  #4B5563   보조 본문
text-tertiary:   #6B7280   메타데이터, 캡션
text-disabled:   #9CA3AF   비활성
text-inverse:    #FFFFFF   다크 배경 위 텍스트
text-brand:      #7C3AED   브랜드 컬러 텍스트 (링크, 강조)
text-on-brand:   #FFFFFF   brand-500 배경 위 텍스트
```

#### 시맨틱
```
success-bg:     #ECFDF5     warning-bg:     #FFFBEB     error-bg:     #FEF2F2     info-bg:     #EFF6FF
success-border: #A7F3D0     warning-border: #FDE68A     error-border: #FECACA     info-border: #BFDBFE
success-fg:     #047857     warning-fg:     #B45309     error-fg:     #B91C1C     info-fg:     #1D4ED8
success-solid:  #10B981     warning-solid:  #F59E0B     error-solid:  #EF4444     info-solid:  #3B82F6
```

사용 가이드:
- **success**: 환불 완료, 시간 확정, 예약 완료 카드
- **warning**: 1h 환불 경계 임박, 노쇼 카운터 경고
- **error**: 결제 실패, 취소 불가, 권한 거부
- **info**: 안내성 배너 ("실시간 업데이트 지연 중")

### 3.2. 다크 모드 토큰

다크는 라이트의 색 반전이 아니라 **독립 디자인**. 채도 10~20% 낮추고, 보라는 살짝 밝힘.

#### 브랜드 (다크)
```
brand-50:   rgba(155, 122, 255, 0.06)
brand-100:  rgba(155, 122, 255, 0.12)
brand-200:  rgba(155, 122, 255, 0.20)
brand-300:  #5B3DA0   히트맵 ramp 2 (다크)
brand-400:  #7C5CDB
brand-500:  #9B7AFF   **메인 브랜드 (다크)** — PRD 명시
brand-600:  #B69FFF   pressed (다크에서 pressed는 더 밝아짐)
brand-700:  #C9B6FF
```

#### 표면 (다크)
```
surface-0:   #0F0F12   페이지 배경 — PRD 명시
surface-1:   #16161B   카드
surface-2:   #1C1C22   elevated 카드, 모달
surface-3:   #25252C   pressed, hover
```

#### 보더 (다크)
```
border-subtle:  #2A2A33
border-strong:  #3A3A44
border-focus:   #9B7AFF
```

#### 텍스트 (다크)
```
text-primary:    #F4F4F5
text-secondary:  #A1A1AA
text-tertiary:   #71717A
text-disabled:   #52525B
text-inverse:    #0F0F12
text-brand:      #9B7AFF
text-on-brand:   #0F0F12   (다크 모드에선 보라가 밝아 검정 텍스트가 대비 더 좋음)
```

#### 시맨틱 (다크)
```
success-bg:     rgba(16, 185, 129, 0.12)   success-fg:  #34D399   success-solid: #10B981
warning-bg:     rgba(245, 158, 11, 0.12)   warning-fg:  #FBBF24   warning-solid: #F59E0B
error-bg:       rgba(239, 68, 68, 0.12)    error-fg:    #F87171   error-solid:   #EF4444
info-bg:        rgba(59, 130, 246, 0.12)   info-fg:     #60A5FA   info-solid:    #3B82F6
```

### 3.3. 대비 (Contrast) 검증

모든 텍스트·배경 조합은 WCAG AA(4.5:1 본문, 3:1 큰 텍스트) 충족. 핵심 검증:

| 조합 | 비율 | 결과 |
|---|---|---|
| text-primary (#111827) on surface-0 (#FFFFFF) | 17.7:1 | AAA |
| text-secondary (#4B5563) on surface-0 | 8.6:1 | AAA |
| text-tertiary (#6B7280) on surface-0 | 5.7:1 | AA (본문) |
| text-on-brand (#FFFFFF) on brand-500 (#7C3AED) | 5.9:1 | AA |
| text-primary (#F4F4F5) on surface-0 (#0F0F12) [다크] | 17.0:1 | AAA |
| text-on-brand (#0F0F12) on brand-500 [다크] (#9B7AFF) | 7.8:1 | AAA |

**금지 조합** (대비 부족):
- text-disabled를 본문 색으로 사용
- 라이트 모드에서 brand-300 이하를 텍스트 색으로 사용
- 다크 모드에서 text-tertiary를 본문 본격 표시에 사용

---

## §4. 히트맵 색 램프

15분 시간 그리드 셀이 가능한 멤버 수에 따라 진해지는 ramp. 5개 스톱.

### 4.1. 라이트 모드 ramp

```
heat-0 (없음, 0%):   #F9FAFB   neutral 연한 회색 (= surface-2 톤) — "선택된 상태가 아니라 빈 슬롯"임을 명시
heat-1 (소수, ~25%): #EDE9FE   brand-100
heat-2 (절반, ~50%): #C4B5FD   brand-300
heat-3 (대부분, ~75%): #8B5CF6  (사이 톤)
heat-4 (전원, 100%):  #7C3AED  brand-500 — 모두 가능한 슬롯
```

### 4.2. 다크 모드 ramp

```
heat-0:   #25252C   surface-3 (다크) — 빈 슬롯
heat-1:   #3D2A66   딥 퍼플 그레이
heat-2:   #5B3DA0
heat-3:   #7C5CDB
heat-4:   #9B7AFF   brand-500 (다크) — 모두 가능
```

### 4.3. ramp 사용 규칙

- **0 (heat-0)은 반드시 중립 그레이**. 옅은 보라(brand-50)와 다르다. 그렇지 않으면 "내가 살짝 찍어둔 슬롯"과 헷갈린다.
- **본인이 찍은 슬롯**은 ramp가 아닌 별도 시각: 보라 보더 2pt + brand-50 fill. ramp는 "전체 가능 인원" 표시 전용.
- **5단계로 압축한 이유**: 100단계 grayscale은 사람 눈으로 구분 불가. 5단계가 인지 가능한 최대 해상도.

---

## §5. 간격 (4pt 그리드)

모든 padding, margin, gap은 이 스케일에서 선택한다. 임의 값(7px, 13px 등) 금지.

```
space-0:    0
space-px:   1px         (hairline, divider)
space-0.5:  2px         (드물게 — 아이콘 inset 등)
space-1:    4px
space-2:    8px         ★ 기본 컴포넌트 내부 간격
space-3:    12px
space-4:    16px        ★ 카드 padding, 화면 좌우 inset
space-5:    20px
space-6:    24px        ★ 섹션 간격
space-8:    32px
space-10:   40px
space-12:   48px
space-16:   64px
space-20:   80px
```

### 5.1. 적용 가이드

- **화면 좌우 inset (gutter)**: `space-4` (16pt) — SE급 320pt 폭에서 콘텐츠 288pt 확보
- **카드 padding**: `space-4` (16pt)
- **섹션 간격 (vertical)**: `space-6` (24pt)
- **컴포넌트 내부 (아이콘-텍스트)**: `space-2` (8pt)
- **버튼 padding**: 수평 `space-4`, 수직 `space-3` (높이 48pt = 44pt 터치 + 약간 여유)
- **터치 타깃 최소**: 44pt × 44pt (시각 크기보다 hit area가 우선)

### 5.2. 시간 그리드 특수 케이스

PRD §10에 명시된 8pt 셀은 **시각 크기**다. 터치 타깃은 **44pt**로 확장.

- 시각 셀: 폭 = (화면폭 - 좌우 inset - 시간 라벨 컬럼) / 7일, 높이 = 8pt
- 터치 hit area: 폭 동일, 높이 44pt (인접 셀과 겹침 허용 — `hitSlop` props 사용)
- 단일 탭 = 1슬롯 토글, 드래그 sweep = 멀티 선택 (PRD 기본 메커닉)

---

## §6. 모션 (Motion)

### 6.1. 지속시간 (Duration)

```
duration-instant:  50ms    탭 피드백 (눌렀을 때 색 변화)
duration-micro:    100ms   색 전환, 작은 페이드
duration-short:    150ms   작은 트랜슬레이트, 아이콘 토글
duration-medium:   250ms   ★ 모달·바텀시트 in/out, 페이지 푸시
duration-long:     400ms   페이지 트랜지션 (route change)
duration-x-long:   600ms   축하 모먼트 — 히트맵 "전원 가능" 셀이 차오를 때
```

### 6.2. Easing

```
easing-standard:    cubic-bezier(0.4, 0.0, 0.2, 1)    ★ 기본 — 대부분 트랜지션
easing-enter:       cubic-bezier(0.0, 0.0, 0.2, 1)    ★ 진입 (모달 in, 시트 up)
easing-exit:        cubic-bezier(0.4, 0.0, 1.0, 1)    ★ 퇴장 (모달 out)
easing-emphasized:  cubic-bezier(0.2, 0.0, 0.0, 1.0)  확정 모먼트 (시간 확정, 결제 성공)
```

### 6.3. Spring (Reanimated, 그리드 드래그용)

```ts
{ damping: 18, stiffness: 200, mass: 1 }
```

드래그 sweep 시 손가락 추종에 사용. 시간 그리드 셀이 끈적이지 않고 따라온다.

### 6.4. 모션 감소 (Reduced Motion)

`AccessibilityInfo.isReduceMotionEnabled()`가 `true`일 때:
- 모든 `duration-medium` 이상 → `duration-micro` (100ms)
- Spring → 단순 fade
- `duration-x-long` 축하 모션 → 단순 색 전환

### 6.5. 사용 가이드 — 어디서 무엇을 쓰나

| 트랜지션 | duration | easing |
|---|---|---|
| 버튼 tap 색 변화 | instant | standard |
| 토스트 in | short | enter |
| 토스트 out | short | exit |
| 바텀시트 up | medium | enter |
| 바텀시트 down | medium | exit |
| 페이지 push | medium | standard |
| 모달 in | medium | enter |
| 히트맵 셀 색 변화 (한 단계) | short | standard |
| 히트맵 셀 → heat-4 (전원 가능) | x-long | emphasized |
| 시간 확정 카드 등장 | long | emphasized |
| 결제 성공 카드 등장 | long | emphasized |
| 모임 만들기 FAB 회전 | short | standard |

---

## §7. 그림자 / Elevation

그라데이션·글래스모피즘 금지. 깊이는 **그림자 + 보더 + 표면 색**으로만 표현.

### 7.1. 라이트 모드 elevation

```
e0  flat                  shadow: none, border: none
e1  subtle card           shadow: 0 1px 2px rgba(0,0,0,0.04) + 0 1px 1px rgba(0,0,0,0.03)
                          또는 border: 1px solid border-subtle (둘 중 하나, 둘 다 X)
e2  raised card           shadow: 0 2px 4px rgba(0,0,0,0.06) + 0 1px 2px rgba(0,0,0,0.04)
e3  modal / sheet         shadow: 0 8px 16px rgba(0,0,0,0.08) + 0 2px 4px rgba(0,0,0,0.04)
e4  FAB / floating        shadow: 0 12px 24px rgba(0,0,0,0.10) + 0 4px 8px rgba(0,0,0,0.06)
```

### 7.2. 다크 모드 elevation

다크에선 그림자가 잘 안 보인다. **표면 색 + 보더**로 깊이를 표현하고, 그림자는 모달 이상부터만.

```
e0  flat                  surface-0, no border
e1  subtle card           surface-1, border-subtle 1px
e2  raised card           surface-2, border-subtle 1px
e3  modal / sheet         surface-2, border-subtle 1px, shadow: 0 8px 16px rgba(0,0,0,0.4)
e4  FAB / floating        surface-2, border-subtle 1px, shadow: 0 12px 24px rgba(0,0,0,0.5)
```

### 7.3. 사용 가이드

| 컴포넌트 | elevation |
|---|---|
| 화면 배경 | e0 |
| 일정 카드, 친구 카드, 모임 카드 | e1 |
| 예약 바텀시트 grabber 영역 | e1 |
| 결제 완료 카드 (강조용) | e2 |
| 모달 (약관 동의, 친구 초대장) | e3 |
| 바텀시트 (식당 정보) | e3 |
| 모임 만들기 FAB (가운데 탭) | e4 |
| 토스트 / 스낵바 | e3 |

---

## §8. 곡률 (Border Radius)

```
radius-none:   0
radius-sm:     4px       입력 필드, 작은 뱃지
radius-md:     8px       ★ 기본 — 카드, 버튼, 체크박스
radius-lg:     12px      큰 카드, 모달 안 섹션
radius-xl:     16px      모달 자체
radius-2xl:    24px      바텀시트 상단 (only 상단 좌우)
radius-pill:   9999px    pill 버튼, 멤버 아바타 그룹 inset, 뱃지
radius-full:   9999px    아바타, 동그라미 컨테이너
```

**규칙**: 한 화면에 4가지 이상의 radius 사용 금지. 일반적인 화면은 `radius-md`(카드/버튼) + `radius-full`(아바타) 두 개로 충분.

---

## §9. 아이코노그래피

### 9.1. 시스템 라이브러리 — Lucide

```bash
expo install lucide-react-native react-native-svg
```

- **기본 크기**: 24px (모바일 표준)
- **stroke**: 2px (Lucide 기본 — 변경 금지)
- **색**: `text-primary` 또는 `text-secondary` 컨텍스트 따라
- **호버 / pressed 없음** (모바일이라 호버 X, pressed는 surface 색으로 처리)

#### 자주 쓰는 아이콘 매핑 (작명 일관성)

| 의미 | Lucide 아이콘 |
|---|---|
| 홈 | `house` |
| 친구 | `users-round` |
| 지도 | `map` |
| 프로필 | `user-round` |
| 시간 | `clock` |
| 캘린더 | `calendar-days` |
| 장소 | `map-pin` |
| 검색 | `search` |
| 필터 | `sliders-horizontal` |
| 더보기 (방장 메뉴) | `more-vertical` |
| 신고 | `flag` |
| 차단 | `ban` |
| 알림 켜짐 | `bell` |
| 알림 꺼짐 | `bell-off` |
| 카톡 공유 | `share-2` |
| 추가 (친구) | `user-plus` |
| 확정 | `check` |
| 닫기 | `x` |
| 뒤로 | `chevron-left` |
| 화살표 | `arrow-right`, `chevron-right` |
| 결제 | `credit-card` |
| 환불 | `arrow-left-right` |
| 다크/라이트 | `moon` / `sun` (수동 토글은 차기) |

### 9.2. 커스텀 세트 (~6개)

다음은 **브랜드 정체성·시스템 한계**로 커스텀이 필요한 케이스:

1. **브랜드 마크** — 된다 로고 (SVG, 다크/라이트 두 버전)
2. **제휴 마커 (지도용)** — Naver Maps SDK는 SVG 마커 직접 렌더 안 됨. **PNG 래스터 1.5x/2x/3x** 출력. 모양: 브랜드 보라(#7C3AED) 원형 + 흰 inner stroke + 약간 더 큰 사이즈. 비제휴 마커는 Naver 기본 회색 핀.
3. **FAB 글리프** — 가운데 탭 "모임 만들기". `plus` 단독 X. 작은 캘린더+plus 합성 아이콘 (16pt 화이트 SVG). §16.1.5 미해결 → 디자인 확정 시 커밋.
4. **히트맵 밀도 칩** — 그리드 우상단 범례 표시용 (5단계 미니 ramp 표시). SVG 인라인.
5. **노쇼 뱃지** — 프로필 노쇼 카운터에 표시되는 작은 경고 뱃지 (브랜드 톤에 맞춘 절제된 모양, Lucide `alert-triangle` 보강).
6. **환불 상태 핀** — 모임 상세 "예약 취소됨" 카드 좌상단. 시맨틱 success/warning 색 적용.

### 9.3. 금지

- 이모지 디자인 요소 (🎉 🚀 💜 등) — 시스템 이모지는 사용자 콘텐츠로만
- 컬러 일러스트 아이콘 (line-only 또는 단색 fill만)
- 1px stroke 또는 3px+ stroke (2px 고정)

---

## §10. 컴포넌트 적용 가이드 (§10 V2_PRD §10.3 보강)

이 섹션은 기존 PRD §10.3의 컴포넌트 리스트를 토큰화한다.

### 10.1. 시간 그리드 셀

```
시각 셀:        높이 8pt, 너비 (gridWidth/7)
hit area:       44pt × (셀너비) — hitSlop으로 확장
배경 (빈):       heat-0
배경 (본인 선택): brand-50 + border 1.5pt brand-500 inset
배경 (히트맵):   heat-0 ~ heat-4
드래그 중 sweep: spring(damping:18, stiffness:200) 따라옴
hover (X):      모바일이라 없음
```

### 10.2. 제휴 마커

```
shape:    children 커스텀 뷰 (RN View, NaverMapMarkerOverlay children) — D40, PNG 래스터 대체
size:     비제휴 마커의 1.4배 (1.5배 너무 큼)
color:    brand-500 (다크: brand-500 다크)
inner:    2pt 흰 stroke (다크: 0F0F12 stroke) — surface-0 토큰으로 자동 (라이트 흰/다크 0F0F12)
state - selected: scale 1.15 (medium duration, emphasized easing)
```

> **D40 (2026-06-09)**: 마커는 PNG 에셋(Q-B13) 대신 `MapMarkerView`(brand-500 원 + 흰 inner stroke + order 숫자)를 `NaverMapMarkerOverlay`의 children으로 넘겨 렌더. 네이티브가 RN 뷰를 래스터화 → 색·크기·stroke를 DESIGN 토큰으로 직접 제어, PNG 불필요. ("Naver SDK SVG 불가"는 유효하나 children 래스터화로 우회.)

### 10.3. 예약 바텀시트 (5.7)

```
컨테이너:    radius-2xl 상단만, e3, surface-1
grabber:    가로 36pt × 4pt, surface-3, radius-full, top space-2
사진:        radius-md, 16:9 비율, 1장 (캐러셀 차기)
이름:        title-2
카테고리·평점: caption text-tertiary
영업시간:    body-sm tabular-nums
보증금 라인:  body-bold + brand-500 (₩20,000 강조)
환불 정책 핀: pill (success/warning 시맨틱 칩 3개 — "24h 100%" / "1~24h 50%" / "1h 0%")
CTA:        brand-500 fill, text-on-brand, radius-md, 높이 56pt
```

### 10.4. 결제 상태 카드 (모임 상세 내)

```
컨테이너:   surface-1, e2, radius-lg, padding space-4
left rail:  2pt brand-500 stripe (확정) / success-solid (완료) / error-solid (취소)
상태 라벨:  body-sm-bold + 시맨틱 컬러
가격:       title-3 tabular-nums
액션:       text-brand 링크 ("취소" / "환불 확인")
```

### 10.5. 동선 폴리라인 ("지도로 내 일정 보기")

```
stroke:      brand-500 (다크: brand-500 다크), 2pt dashed
숫자 배지:    32pt diameter, brand-500 fill, text-on-brand, title-3 weight 700
규칙:        마커 5개 초과 시 폴리라인 자동 숨김 (가장 가까운 두 점만)
```

### 10.6. 신고/차단 메뉴

```
container:   actionsheet 또는 dropdown
text:        body, text-primary (no 시맨틱 컬러로 톤 절제)
아이콘:      Lucide flag / ban (text-tertiary)
파괴적 액션: error-fg only (절제된 빨강)
```

### 10.7. FAB (가운데 탭 모임 만들기)

```
size:        56pt × 56pt
shape:       radius-md (둥근 사각형, 원형 아님 — 슬롯 모양 토스 풍 차별화)
fill:        brand-500
glyph:       커스텀 SVG (캘린더+plus 합성)
elevation:   e4
position:    탭바 중앙, y는 탭바 표면 위 16pt 띄움 (notch)
press:       scale 0.96 (instant duration)
```

---

## §11. 상태 토큰 — 빈/로딩/에러 (§5.0 PRD 신규 섹션 권고)

PRD 본문엔 없지만 모든 상태가 디자인되어야 한다. DESIGN.md에서 정한다.

### 11.1. 로딩

- **스켈레톤** (콘텐츠 위치/모양 미리 보이는 회색 도형): 첫 fetch + 카드 리스트
  - 색: `surface-3` (다크: `surface-3`)
  - shimmer 애니메이션: duration-long, ease-in-out, opacity 0.6 ↔ 1
- **인디터미닛 스피너**: 액션 진행 (결제 위젯 로드 등)
  - Lucide `loader-2` 회전 (duration 1s linear infinite)
  - 크기 24pt, color text-brand

### 11.2. 빈 상태 (Empty)

모든 빈 상태는 다음 3요소 필수:
1. **이미지/그래픽** (커스텀 line art 또는 따뜻한 톤 일러스트, 단색 + brand-200)
2. **카피** — 1줄 헤드라인 (`title-3`) + 1줄 보조 (`body-sm` `text-secondary`)
3. **primary CTA** (실행 가능한 다음 액션)

핵심 빈 상태 (베타 P0):
- 홈 / 신규 사용자: "첫 모임을 만들어볼까요?" + `[(+) 모임 만들기]`
- 친구 목록: "친구를 초대해보세요" + `[카톡으로 초대]`
- 내 모임: "아직 모임이 없어요" + `[(+) 만들기]`
- 시간 그리드 첫 진입: 본인 슬롯 안내 ghost text "꾹 누르고 sweep으로 가능 시간 표시"
- 지도 viewport에 결과 0개: "이 영역에 매장이 없어요. 반경을 늘려보세요." + `[반경 +1km]`

### 11.3. 에러

3가지 시각 패턴, 심각도 따라 사용:

| 패턴 | 사용 케이스 | 컴포넌트 |
|---|---|---|
| **인라인** | 폼 필드 (전화번호 형식 오류 등) | body-sm error-fg 텍스트, 필드 하단 |
| **배너** | 페이지 단위 가벼운 경고 ("실시간 업데이트 지연") | info-bg full-width, dismiss X |
| **모달 / 토스트** | 액션 실패 (결제 실패) | error 시맨틱 컬러, 명확한 재시도/취소 CTA |

**금지**: 알럿(Alert) 시스템 모달로 에러 표시 (iOS/Android 시스템 알럿은 마지막 수단). 우리 디자인 시스템 안에서 처리.

### 11.4. 부분 / 오프라인

- **부분 동기화**: 캘린더 출처별 인디케이터 (Google ✓ / Apple ✗ / 에브리타임 ✓), 실패 출처는 retry 텝
- **오프라인**: 상단 sticky 배너 — info-bg, body-sm "오프라인 — 마지막 동기화: 10분 전"
- **Realtime 끊김** (히트맵): 그리드 헤더 info-bg 칩 "실시간 갱신 일시 중단 — 30s 후 폴링"

---

## §12. 접근성 (a11y) — V2_PRD §15.5 대체

이전 §15.5는 4줄 짜리 stub이었다. 여기서 사양으로 격상.

### 12.1. 터치 타깃

- **최소 44pt × 44pt** (iOS HIG / WCAG 2.5.5).
- 시각 크기가 작은 경우 `hitSlop`으로 확장. 인접 컨트롤과 겹쳐도 OK (시간 그리드 셀이 대표).
- FAB 56pt (이미 충족).

### 12.2. 대비

- 모든 본문 텍스트 ≥ 4.5:1
- 큰 텍스트(`title-*`) ≥ 3:1
- 시맨틱 컬러는 색만으로 의미 전달 금지 → 항상 아이콘 동반
- 비활성 상태도 대비 ≥ 3:1 유지 (사용자가 "있는지 모르는" 비활성 금지)

### 12.3. 스크린 리더 (VoiceOver / TalkBack)

모든 상호작용 가능 컴포넌트는 `accessibilityLabel` + `accessibilityRole` 필수.

핵심 라벨링:
- 그리드 셀: "5월 22일 19시 30분, 3명 가능, 더블탭으로 선택"
- 제휴 마커: "제휴 식당, 또띠아, 4.5점, 더블탭으로 정보 보기"
- 히트맵 인디케이터: "전원 가능한 슬롯"
- 결제 CTA: "20,000원 결제, 환불 정책 별도 확인"
- FAB: "새 모임 만들기"

라벨은 한국어 원본. 영문 폴백 베타 범위 아님.

### 12.4. 동적 타입 (Dynamic Type / Font Scale)

- 본문(`body`, `body-sm`, `caption`, `micro`) → 시스템 스케일 100% 응답
- 타이틀(`title-*`, `display`) → 130%까지 응답, 그 이상은 클램프
- 시간 그리드 헤더 → 응답 안 함 (레이아웃 깨짐 위험. 명시적 opt-out)
- React Native: `Text` 컴포넌트 기본 `allowFontScaling` true, opt-out은 명시

### 12.5. 모션 감소

`AccessibilityInfo.isReduceMotionEnabled()` true일 때 §6.4 규칙 적용.

### 12.6. 색맹 (Color Blindness)

- 제휴 마커: 색 + 크기 + **약간의 inner stroke** (3중 신호 — 색 단독 의존 금지)
- 히트맵: 색 + 라벨 ("3/5명") — 호버/탭 시 카운트 노출
- 시맨틱 컬러: 항상 아이콘 동반

### 12.7. 지원 디바이스 폭

- **최소**: 320pt (iPhone SE 2/3세대)
- **기본 설계 폭**: 390pt (iPhone 13/14)
- **최대**: 430pt (iPhone Pro Max)
- 폴더블: 펼친 상태에서 max width 430pt 클램프 (좌우 여백 자동 확대)

---

## §13. 토큰 매핑 (코드 적용)

React Native + Expo 환경 권장 구조:

```
src/
  design/
    tokens.ts        ← 이 문서의 토큰을 type-safe export
    theme.ts         ← light/dark 분기 + Context Provider
    typography.tsx   ← <Text> 변형 컴포넌트 (Title, Body, Caption)
```

#### tokens.ts 스켈레톤

```ts
export const tokens = {
  light: {
    brand: { 50: '#F5F3FF', 100: '#EDE9FE', /* ... */ 500: '#7C3AED', 600: '#6D28D9' },
    surface: { 0: '#FFFFFF', 1: '#FFFFFF', 2: '#F9FAFB', 3: '#F3F4F6' },
    border: { subtle: '#E5E7EB', strong: '#D1D5DB', focus: '#7C3AED' },
    text: { primary: '#111827', secondary: '#4B5563', tertiary: '#6B7280', /* ... */ },
    heat: ['#F9FAFB', '#EDE9FE', '#C4B5FD', '#8B5CF6', '#7C3AED'],
    semantic: { success: { bg: '#ECFDF5', fg: '#047857', solid: '#10B981' } /* ... */ },
    overlay: { scrim: 'rgba(0, 0, 0, 0.4)' }, // 시트/모달 backdrop (W0-8, dark=0.6)
  },
  dark: { /* ... */ },
  space: { 0: 0, px: 1, '0.5': 2, 1: 4, 2: 8, 3: 12, 4: 16, /* ... */ },
  radius: { none: 0, sm: 4, md: 8, lg: 12, xl: 16, '2xl': 24, pill: 9999, full: 9999 },
  duration: { instant: 50, micro: 100, short: 150, medium: 250, long: 400, xLong: 600 },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',
    enter:    'cubic-bezier(0.0, 0.0, 0.2, 1)',
    exit:     'cubic-bezier(0.4, 0.0, 1.0, 1)',
    emphasized: 'cubic-bezier(0.2, 0.0, 0.0, 1.0)',
  },
} as const;
```

**규칙**: 컴포넌트에서 hex 직접 작성 금지. 항상 `tokens.light.brand[500]` 형태로 참조.

---

## §14. 미해결 결정 (build 시작 전 closure 필요)

다음 결정은 본 문서에 미반영. 구현 sprint 시작 전 closure.

| ID | 결정 | 책임 | 권고 시점 |
|---|---|---|---|
| D-FAB | FAB 글리프 최종 디자인 (§9.2.3, §16.1.5) | 디자인 | sprint 0 |
| D-LOGO | 된다 브랜드 마크 라이트/다크 SVG | 디자인 | sprint 0 |
| D-EMPTY-ART | 빈 상태용 일러스트 5종 (§11.2) | 디자인 | sprint 1 |
| D-PUSH-COPY | F1~F7 푸시 알림 마이크로카피 (PRD §9.1) | 카피 | sprint 1 |
| D-PARTNER-MARKER | 제휴 마커 PNG 1.5x/2x/3x export | 디자인 | sprint 0 |
| D-ONBOARD-MOTION | 3슬라이드 온보딩 — 실제 앱 화면 모션 캡처 (일러스트 X) | 디자인 + 엔지니어링 | sprint 2 |

이들은 토큰이 아니라 자산이다. 토큰 시스템이 자산을 받쳐주지만, 자산 자체는 별도 산출물.

---

## §15. 변경 절차

DESIGN.md 변경은 다음 절차를 따른다:

1. 변경 제안을 PR or Issue로 명시 (단순 토큰 추가 OK, 기존 토큰 변경은 영향 분석 필수)
2. 영향 받는 컴포넌트·화면 목록 첨부
3. 라이트/다크 모드 모두 검증
4. 대비·접근성 회귀 체크
5. 본 §16 결정 로그에 기록

**파괴적 변경** (기존 토큰 값 변경, 토큰 제거, 스케일 재정의)은 §16 결정 로그에 PR 링크 + 합리화 필수.

---

## §16. 결정 로그

| 일자 | 결정 | 합리화 |
|---|---|---|
| 2026-05-21 | 초기 DESIGN.md 작성 | /plan-design-review 결과(§10이 15줄로 부족) 후 /design-consultation 합의. Pretendard·4pt·풀 컬러 토큰·히트맵 ramp·모션·elevation·아이콘 라이브러리 7개 영역 commit. |
| 2026-05-21 | Pretendard Variable 채택 | 한국어 + Latin + 숫자 단일 패밀리. 가변 폰트 = 1 파일 번들. 모던 한국 앱 사실상 표준. |
| 2026-05-21 | 아이콘 = Lucide + 6 커스텀 | 2px stroke 절제 톤이 토스 풍과 매치. Phosphor는 4-weight라 표현 과잉. 맵 마커는 Naver SDK 제약으로 PNG. |
| 2026-05-21 | 8pt 시각 셀 + 44pt hit area | WCAG 2.5.5 충족 + PRD의 sweep 제스처 보존. PRD §15.5의 "정확도 보완" 모호 표현을 사양화. |
| 2026-05-21 | 히트맵 heat-0 = 중립 그레이 | 옅은 보라가 "본인 선택"과 충돌함. 본인 선택은 brand-50 + 보더, 히트맵 빈 슬롯은 surface-3. |
| 2026-05-25 | §17 anti-AI-feel 원칙 추가 | 1차 베타 화면 회고: 토큰은 잘 잡혔지만 적용 화면에서 "AI 생성물 같다"는 피드백. 위계·반복 CTA·빈 placeholder·brand identity 부재가 주원인. §17에서 구체 안티패턴 6가지를 카탈로그화. |
| 2026-07-08 | `overlay` 토큰 추가 (W0-8) | 바텀시트·모달 backdrop `rgba(0,0,0,0.4)` 하드코딩 2곳+(ConfirmSlotSheet·PlaceActionSheet)을 토큰화. light `scrim`=0.4 / dark=0.6 흑(어두운 배경 위 시트 분리). UI 폴리시 플랜 승인에 포함. §15 절차 준수 — light/dark 검증 + tokens.test.ts 구조 parity·alpha<1 테스트 추가, 단순 토큰 추가(기존 값 변경 0). |

---

## §17. Anti-AI-feel 디자인 원칙

> "AI가 만든 것 같다"는 피드백은 시각적 결함이 아니라 **콘텐츠 부재**, **위계 평탄화**, **반복 패턴**의 결합이다. 이 §17은 흔히 발생하는 6가지 안티패턴을 명시하고 대응 패턴을 제시한다.

### 17.1. 안티패턴 — 반복 CTA의 시각 노이즈

**증상**: 리스트(친구 목록, 모임 목록 등) 각 항목마다 동일한 brand-500 fill CTA가 반복.

**왜 잘못됐나**: D5 "Purple Discipline" 직접 위반. 보라는 의미 있을 때만(메인 CTA, heat-4, 모임 확정). 매 줄 보라 = 의미 인플레이션 = 노이즈.

**대응**:
- 리스트 항목은 **카드 자체가 tap target**. 우측엔 `chevron-right` 아이콘만 (`text-tertiary`).
- 액션은 카드 진입 후 detail 페이지 또는 바텀시트에서.
- 리스트당 brand-500 fill CTA는 **0개 또는 1개**(섹션 헤더의 "모두 보기" 같은 utility 한정).
- 진짜 "각 항목마다 액션이 필요한" 경우(예: 친구 요청 수락/거절 페어)는 예외 — 위계 명확화를 위해 **ghost + filled 페어**로 사용.

### 17.2. 안티패턴 — 빈 화면 placeholder

**증상**: 화면 중앙에 "된다" 로고와 "환영합니다" 텍스트 + 작은 버튼 하나. 위·아래 거대한 빈 공간.

**왜 잘못됐나**: 빈 공간이 "디자인된 여백"이 아니라 "콘텐츠 부재"로 읽힘. 화면의 가치를 0으로 만든다.

**대응**:
- 첫 화면은 **즉시 가치**: 인사 + 통계 칩 + 빠른 액션 그리드 + 다가오는 일정 섹션.
- 데이터가 없어도 §11.2의 빈 상태(아이콘 + 헤드라인 + 보조 카피 + CTA) 3요소 의무.
- "loading" 또는 "환영" 외에는 항상 **다음 액션의 시각 entry-point**가 보여야 함.

### 17.3. 안티패턴 — 위계 평탄화

**증상**: 모든 텍스트가 비슷한 무게로 표시. nickname(body-bold) · meta(caption) 같은 단일 위계만 사용.

**왜 잘못됐나**: Pretendard Variable의 100~900 연속 weight를 안 활용. 정보 우선순위가 시각으로 전달 안 됨.

**대응**:
- 카드 내 위계 ≥ 3단계: **primary**(`title-3` 또는 `body-bold`) → **secondary**(`body-sm` `text-secondary`) → **tertiary**(`caption` `text-tertiary` + 보조 아이콘/도트).
- 숫자가 핵심인 카드(통계, 잔액, 카운터)는 숫자를 `title-2` 이상 + `tabular-nums`로 격상.
- 액티비티 상태는 **색 단독이 아니라 dot indicator + 라벨** 페어 (D5 색 의존 금지와 일치).

### 17.4. 안티패턴 — 시각 자산 0 (브랜드 boot trap)

**증상**: 로그인·온보딩·홈 헤더에 wordmark만. 일러스트, 미니 시각 컴포넌트, 데이터 시각화 부재.

**왜 잘못됐나**: "된다"라는 강한 브랜드명에 비해 시각 표현이 텍스트뿐 → AI 텍스트 생성기 느낌. 토스/당근 등은 항상 미니 그래픽으로 가치를 시각화.

**대응**:
- **로그인 hero**: 시간 그리드 미니 데모(heat ramp 5칸) 또는 보라 액센트 그래픽 1개. 라인아트 일러스트 placeholder도 가능 (§9.3 "컬러 일러스트 금지"와 충돌 X — 단색 line-only).
- **온보딩 슬라이드**: 각 슬라이드마다 미니 시각 컴포넌트 — 시간 슬라이드는 heat ramp, 장소 슬라이드는 마커 미니 맵, 캘린더 슬라이드는 미니 캘린더 그리드. 실제 앱 컴포넌트 축소판이어야 함 (D-ONBOARD-MOTION 대비).
- **홈 헤더**: wordmark + 작은 brand-500 액센트 도트 또는 underbar. 헤더만 봐도 "된다 앱"임이 인지되어야.

### 17.5. 안티패턴 — disabled가 "방금 누를 수 있던 것처럼" 살아있음

**증상 (revised 2026-05-25)**: disabled CTA를 brand-200 또는 brand-500 50% opacity로 표현 → 사용자가 "누를 수 있나?" 추측. brand 색감이 살아 있어 가짜 affordance.

**왜 잘못됐나 — 1차 추정과 반대 결론**: 처음엔 "회색 = 막혔다 = 앱 결함 신호"라 우려해 brand-200을 권장했으나, 토스/캐치테이블 실측 결과 disabled CTA는 명백히 죽은 회색(surface-2 + text-tertiary)을 쓰고 활성화 시점에만 brand-500이 들어온다. 한국 사용자 학습 패턴이 이미 "회색 = 비활성 / brand = 활성"으로 락인되어 있어 brand-200 disabled는 오히려 가짜 affordance가 된다.

**대응 (revised)**:
- **disabled**: `surface-2` 배경 + `text-tertiary` 글씨. 회색이지만 텍스트는 읽힘(대비 ≥ 3:1).
- **활성**: `brand-500` 풀 컬러. 활성화 트랜지션은 `duration-micro` 색 전환으로 명시.
- **hint 카피는 필수**: "필수 약관에 동의해주세요" 같은 상태 안내를 CTA 위 inline 표시. "왜 못 누르는지" 단서는 색이 아니라 텍스트로.
- **press 피드백 살림**: disabled 상태도 짧은 색 변화(0→0.1 opacity overlay) 또는 haptic으로 "눌렀음은 인지됨, 다만 조건 미충족" 시그널.

### 17.6. 안티패턴 — 무미건조한 마이크로카피

**증상**: "환영합니다", "준비 중입니다", "친구 요청을 보냈습니다" 같은 시스템 톤.

**왜 잘못됐나**: "된다"의 톤(반말 가까운 친근체 — "한 번에 정해요")과 단절. 시스템 메시지가 모드 전환의 갭을 만듦.

**대응**:
- **인사**: "{닉네임}님, 어떤 모임 잡아볼까요?" (구체 액션 prompt)
- **빈 상태**: "아직 모임이 없어요. 첫 모임 만들어볼까요?" (질문형 + 다음 액션)
- **성공**: "요청 보냈어요!" (느낌표 + 반말 어미)
- **실패**: "다시 시도해볼게요" (자책 X, 함께 해결 톤)
- 비-OS-시스템 톤 일관: "확인" → "알겠어요", "취소" → "그만두기" (전체 UI 일관 룰은 [Q-B12](OPEN_QUESTIONS.md#q-b12--f1f7-푸시-알림-마이크로카피) closure 시점에 락).

### 17.7. 적용 체크리스트 (PR 전 self-review)

- [ ] 한 화면 내 brand-500 fill CTA가 1개 이하인가? (헤더 우상단 보조 액션 제외)
- [ ] 모든 빈 상태가 §11.2의 3요소(아이콘 · 카피 · CTA)를 갖추는가?
- [ ] 카드 내 정보 위계가 ≥ 3단계로 시각화되는가?
- [ ] hero 영역(로그인·온보딩·홈 헤더)에 텍스트 외 시각 요소가 ≥ 1개 있는가?
- [ ] disabled CTA가 `surface-2` + `text-tertiary` 회색 죽은 톤(brand 색감 0)인가? (§17.5 revised 2026-05-25)
- [ ] 마이크로카피가 "{nickname}님" 친근체로 일관되는가? "확인/취소" 같은 시스템 톤이 남아있지 않은가?

§17 위반은 design-guard hook이 자동 검출하지 못하는 **정성적 문제**다. PR 리뷰어 또는 design-check 스킬이 체크리스트로 확인한다.
