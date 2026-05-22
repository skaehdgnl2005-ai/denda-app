# 된다 (DenDa) — 제품 기획서 (PRD)

> **문서 종류**: 모바일 앱 정식 출시 기획서
> **버전**: v1.0 (β-compact Phase 1+2 활성)
> **작성일**: 2026-05-14 (초안) · 2026-05-22 (β-compact 반영)
> **상태**: **Phase 1+2 활성** — Sprint 0 진행 중. Phase 3 항목은 인라인 `🔒 Phase 3` 라벨로 구분.
> **관련 문서**:
> - 결정: [DECISIONS.md](DECISIONS.md)
> - 미해결: [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)
> - 아키텍처: [ARCHITECTURE.md](ARCHITECTURE.md)
> - 디자인: [DESIGN.md](DESIGN.md)
> - 빌드 태스크: [TASK_BACKLOG.md](TASK_BACKLOG.md)
> - 테스트: [TEST_PLAN.md](TEST_PLAN.md)
> - 의사결정 기록: [archive/OFFICE_HOURS_DESIGN_2026-05-21.md](archive/OFFICE_HOURS_DESIGN_2026-05-21.md), [archive/ENG_REVIEW_2026-05-21.md](archive/ENG_REVIEW_2026-05-21.md), [archive/V2_PRD_2026-05-14.md](archive/V2_PRD_2026-05-14.md)

> ⚠️ **현재 스코프 (Phase 1+2 β-compact)**:
> - 시간 그리드 + 모임 + 캘린더 동기화 + 지도 + **"예약하기" click-through 측정만** (실제 결제 X)
> - 식당 정보 **display-only** (no booking flow)
> - Toss Payments 통합·실제 예약/정산/환불 = **🔒 Phase 3** (Gate #2 ≥25% 통과 시 commit)
> - 자세한 phased rollout: §13 참조

---

## §0. 제품 개요

**된다(DenDa)** 는 친구들과 ① 함께할 시간을 정하고 ② 갈 장소를 찾고 ③ 예약까지 한 번에 끝내는 **소셜 스케줄링·예약 모바일 앱**이다.

React Native (Expo) 기반으로 iOS·Android 양대 플랫폼에 배포되며, **제휴 식당 마켓플레이스 + 예약금 모델**이 결합된 정식 서비스다.

**출시 전략**: β-compact phased rollout. Phase 1+2(현재)에서는 시간 그리드 + 모임 + 지도 + click-through 측정만 빌드해 5개 검증 안 된 premise(P1~P5)에 동시 베팅을 피한다. 실제 결제·정산·식당 활성화는 Gate #2(장소 확정→예약하기 click-through ≥25%) 통과 시 **🔒 Phase 3**로 commit. 자세한 단계는 §13 참조.

### 0.1. 제품의 5가지 핵심 가치

1. **장소·예약이 주력 기능** — 카카오 Local API 기반 동적 매장 검색 + 네이버 지도 SDK + 모임 확정 후 자연스러운 예약 흐름. **Phase 1+2은 display + click-through만**, 실제 예약은 🔒 Phase 3.
2. **예약금 BM 도입** — 호스트가 모임당 20,000원 보증금 결제, 우리 1,500원/건 (7.5%), 식당 정산 18,500원 (92.5%, 토스페이먼츠 분할정산). 베타~Phase 1은 의도적 저마진, 정식 수익은 차기 버전 다층 BM에서. **🔒 Phase 3 — Gate #2 통과 후 활성**.
3. **"지도로 내 일정 보기"** — 캘린더를 지도 모드로 전환, 일정 위치를 숫자 마커 + 폴리라인 동선으로 시각화
4. **시간 그리드 정밀도** — 15분 슬롯, 시간 범위 09:00~24:00 (60슬롯/일), 드래그 멀티 셀렉트 + 실시간 히트맵
5. **소셜 모바일 네이티브 가치** — 카카오 OIDC OAuth ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)), 카톡 공유, 푸시 알림, 양방향 캘린더 동기화, 다크모드

### 0.2. 핵심 메커니즘 6가지

1. **15분 슬롯 드래그 멀티 셀렉트 + 실시간 히트맵** — 꾹 누르고 sweep 제스처
2. **카카오 OIDC OAuth** — Supabase `signInWithIdToken` 표준 flow. 비즈앱 등록 + `account_email` scope은 Phase 3로 이연 ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede))
3. **게스트 투표** — 브라우저 토큰 기반, 시간 투표는 웹 fallback으로 가능 (비회원 마찰 0)
4. **에브리타임 시간표 OCR** — Google Gemini Vision으로 학교 시간표 자동 등록
5. **부분 양방향 캘린더 동기화** — 외부 → 앱 (Read) + 모임 확정 시 외부 캘린더에 자동 Push
6. **토스 풍 절제된 디자인** — 보라 #7C3AED 포인트, 그라데이션·글래스모피즘 금지, 다크모드 자동

---

## §1. 주요 기능 명세 한눈에

> Phase 1+2 vs Phase 3 구분은 다음과 같다:
> - **Phase 1+2 (활성)**: 시간 그리드 + 모임 + 지도 + display + click-through 측정
> - **🔒 Phase 3 (Gate #2 ≥25% 통과 시 commit)**: 실제 결제·정산·환불·노쇼·F6/F7 푸시

| 영역 | 명세 |
|---|---|
| **플랫폼** | React Native (Expo SDK 53+), iOS + Android. 웹은 게스트 투표 fallback 페이지로 유지 (Vercel) |
| **인증** | 카카오 OIDC OAuth (Supabase `signInWithIdToken`). 비즈앱 등록 + `account_email` scope은 Phase 3 ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) |
| **시간 그리드** | 15분 단위, 09:00~24:00 (60슬롯/일, 7일 후보 시 420셀). 60fps Reanimated worklet ([D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec)) |
| **장소·지도** | 네이버 지도 SDK (`@mj-studio/react-native-naver-map`) + 카카오 Local API (동적 매장 검색) |
| **장소 기능** | 카테고리 필터 (제휴·음식점·술집·파티룸·지하철역), 반경 조절 바, 제휴 마커 강조 (E2: 색+크기) |
| **예약 흐름** | Phase 1+2은 모임 확정 → 지도 → 마커 → "예약하기" **click 로깅** + "Phase 1+2: 준비 중" 안내. **🔒 Phase 3** = 실제 토스 결제 위젯 |
| **BM** | 🔒 Phase 3 — 제휴 예약금 모델 — 모임당 20,000원, 우리 1,500원/건 = 7.5%, 식당 92.5% 정산 |
| **결제** | 🔒 Phase 3 — 토스페이먼츠 분할정산 (서브머천트 모델), 에스크로 후 정산 (모임 시점 + 1일) |
| **환불 정책** | 🔒 Phase 3 — 24h 전 100% / 1~24h 전 50% / 1h 이내·노쇼 0% |
| **노쇼 판정** | 🔒 Phase 3 — 기본 정상 처리, 식당이 운영팀 카톡 채널로 신고 시에만 노쇼 페널티 기록 |
| **캘린더 동기화** | Google + Apple iOS 부분 양방향 (Read + Push). 네이버 캘린더는 차기 버전 |
| **푸시 알림** | 7종 P0 — 소셜 3 (친구 요청·수락·모임 초대) + 모임 2 (전 멤버 투표·호스트 확정) + 예약 2 (결제 완료·시간 임박) |
| **다크모드** | 시스템 자동 감지 (네이버 지도 `isNightModeEnabled` 자동 전환) |
| **온보딩** | 3 슬라이드 미니 (시간 맞추기 → 장소 → 예약), 카카오 로그인 직후 첫 실행 시만 |
| **약관·탈퇴** | 회원가입 동의 모달 (약관·개인정보 필수, 마케팅·위치 선택). 탈퇴는 30일 deactivate → 자동 삭제 |
| **신고/차단** | 친구·모임 멤버에 대한 신고/차단, 운영팀 카톡 채널로 수신 |
| **방장 권한** | 호스트: 모임 이름 변경·멤버 강퇴·모임 삭제. 멤버: 모임 나가기. (호스트 위임은 차기) |
| **게스트→회원 전환** | Branch.io deferred deeplink + install attribution |
| **"지도로 내 일정 보기"** | 캘린더 → 지도 모드 전환, 일정 위치를 시간순 ①②③ 숫자 배지 + 보라 점선 폴리라인 |
| **에브리타임 OCR** | 학교 시간표 OCR + 학기 시작/종료일 명시 입력, 매주 반복 일정 자동 생성 |

---

## §2. 비즈니스 컨텍스트 + BM 모델

### 2.1. 시장 포지셔닝

된다는 "캘린더 앱"이 아니라 **"친구들과 같이 보낼 시간을 함께 만드는 도구"** 이고, 여기에 **"같이 갈 장소를 함께 예약하는 도구"** 가 더해진 모바일 앱이다.

경쟁은 두 축에서 일어난다:
- **시간 맞추기 영역**: When2meet, Doodle, 네이버 캘린더, 카카오톡 톡캘린더 — 우리는 카톡 친화 + 모바일 네이티브 + 한국 대학생/직장인 페르소나 최적화로 차별화
- **예약 영역**: 캐치테이블, 테이블링, 네이버 예약, 더테이블 — 우리는 "모임 만들기"라는 진입 맥락에서 자연스럽게 예약으로 흐르는 **end-to-end 경험** + 업계 최저 수수료(7.5%)로 차별화

### 2.2. BM — 예약금 모델 🔒 Phase 3

> ⚠️ **이 섹션의 실제 인프라는 🔒 Phase 3.** Phase 1+2은 "예약하기" click-through만 측정해 Gate #2(≥25%)를 통과해야 본 BM commit. 토스페이먼츠 통합·통신판매업 신고·변호사 약관 검토·실제 정산 인프라는 모두 Phase 3 진입 후 (8-12주 timeline). 자세한 게이트: [G2](DECISIONS.md#g2--gate-2-장소-확정--예약하기-click-through--가장-critical).

| 항목 | 내용 |
|---|---|
| **사용자 결제** | 호스트가 모임당 **20,000원 (고정)** 결제 |
| **우리 수수료** | **1,500원/건 (7.5%, 정상 출석·노쇼 무관)** |
| **식당 정산** | **18,500원/건 (92.5%)** |
| **결제 단위** | 호스트 단독 결제 (멤버 N분할 결제 없음). 호스트가 일단 부담 후 멤버끼리 카톡 송금 등 앱 밖에서 정산 |
| **노쇼 정의** | "호스트가 안 가면 노쇼"로 정의. 다른 멤버 불참은 무관 |
| **노쇼 판정** | 기본 정상 처리. 식당이 운영팀 카톡 채널 1:1로 신고 시에만 호스트 노쇼 페널티 카운터 +1 |
| **노쇼 페널티** | 5회 누적 시 다음 예약 시 경고 표시 (차기: 일시 제한) |
| **정산 시점** | 모임 시점 + 1일 후 식당에 정산 (에스크로 모델). 노쇼 여부와 무관하게 정산 (BM 본질이 보증금) |
| **환불 정책** | 모임 24h 전 100% / 1~24h 전 50% / 1h 이내·노쇼 0% |
| **결제 인프라** | 토스페이먼츠 단독 (분할정산 = 서브머천트 모델) |
| **출시 전략** | **제한 베타** — 강남/홍대/건대 등 1~2개 핫스팟 + 음식점·술집·파티룸 3개 카테고리 |
| **베타 식당 목표** | 출시 시점 최소 20곳, 4주 내 50곳 |
| **식당 가입 방식** | 100% manual 영업 (출시 4~6주 전 시작) |

#### 영업 메시지 (식당 대상)

> 💬 **"손님 1팀당 20,000원 보증금 중 18,500원(92.5%)을 그대로 정산해드립니다. 노쇼 발생해도 동일. 업계 최저 수수료입니다."**

캐치테이블·테이블링·네이버 예약 대비 가장 매력적인 조건. 식당 영업 시 강한 차별화 포인트.

#### 우리 실순익 계산

| 항목 | 금액 |
|---|---|
| 우리 수수료 | 1,500 |
| PG 수수료 (토스, 카드 ~2.9%) | -580 |
| **순익 (카드 결제 시)** | **~920원/건** |
| 순익 (카카오페이 ~2.5%) | ~1,000원/건 |

월 100건 → 약 9만원, 월 1,000건 → 약 92만원, 월 10,000건 → 약 920만원. **베타~Phase 1 단계는 의도적 저마진 운영**, 정식 수익은 차기 버전 다층 BM에서 (§2.4 참고).

### 2.3. 카페가 제휴에서 빠진 이유

카페는 객단가가 낮아(4명 × 6천원 ≈ 24,000원) 2만원 고정 보증금이 매출의 80%+ 비중을 차지해, 사용자에겐 부담이고 식당에도 의미가 약하다. 베타에선 노쇼 보증금이 자연스럽게 동작하는 음식점·술집·파티룸에 집중하고, 카페는 차기 버전에서 **입점 광고·월 구독료** 등 별도 BM으로 재검토한다.

### 2.4. 차기 버전 BM 확장 시나리오 — 수익 다층화

베타~Phase 1은 예약 수수료 1,500원 단일 BM의 단순 구조. 차기 버전(v1.1+)에서 본격 수익은 다음 5가지 축으로 다층화:

1. **카테고리·가격대별 차등 수수료** — 베타 1,500원 고정 → 파인다이닝·룸은 5,000~10,000원, 일반 음식점 1,500~2,500원, 파티룸·모임공간은 가격대 비례
2. **카페·일반 식당 입점 광고비 + 월 구독료** — 노쇼 보증금 모델이 안 맞는 카테고리의 별도 BM (예: 월 9.9만원 입점 + 검색 우선 노출)
3. **Promoted listing** — 지도 상단·검색 결과 상단 노출 광고 (식당 자율 입찰)
4. **프리미엄 사용자 구독** — "된다 프리미엄" (예: 월 4,900원) — 모임 횟수 무제한, 고급 통계, 광고 제거, 예약 우선권 등
5. **식당 BI·데이터** — 시간대별 예약 트렌드, 동네 인구 통계, 경쟁사 비교 등 (식당 대상 유료 인사이트)

기타 인프라 확장:
- 식당 셀프 가입 + 어드민 웹
- 자동 노쇼 판정 (식당 어드민에서 출석 체크 또는 카카오 알림톡 응답)
- 결제 수단 다양화 (포트원 라우터 도입)
- 전국 확장 (베타 검증 결과 기반)

---

## §3. 페르소나

### P1. 친구 모임을 자주 잡는 대학생 (20대 전반)

- 친구 3~6명과 1~2주에 한 번 모임
- 술자리·이자카야·노래방 등 야간 모임 비중 높음 (시간 범위 09~24시 결정의 핵심 근거)
- 에브리타임 시간표를 OCR로 등록해 본인 일정 등록 마찰 ↓
- 학기 시작 시 새 시간표 입력 후 학기 시작/종료일 명시
- **베타 타깃**: 강남/홍대/건대 등 대학가 근처

### P2. 회식·동호회를 만드는 직장인 (20대 후반~30대)

- 부서 회식, 동호회, 친구 모임을 호스트
- 시간 맞추기 + 장소 예약까지 한 번에 끝나면 매우 가치 있음
- 네이버 캘린더 사용자 비중 ↑ (차기 버전으로 미루는 결정에 약간의 트레이드오프)
- Google Workspace 직장인은 양방향 동기화에 큰 가치

### P3. 게스트 (비회원 참여자)

- 카톡 링크로 한 번만 참여
- 앱 설치 마찰이 가장 큰 영향
- **시간 투표까지는 웹 fallback 유지**
- 투표 후 "결과 알림 받으려면 앱 설치" CTA → Branch.io attribution으로 자동 전환

---

## §4. 정보 구조 — 4탭 + FAB

```
[홈] [친구] [(+) 모임 만들기 FAB] [지도] [프로필]
```

- **홈**: 캘린더 (월/주) + 내 일정 + 모임 일정 + "지도로 보기" 토글
- **친구**: 친구 목록 + 내 모임 목록 + 친구 추가
- **(+)**: 모임 만들기 FAB (가운데 탭, FAB 형태)
- **지도**: 모임 특화 일반 지도 — 필터 + 반경 조절 + 동적 매장 검색
- **프로필**: 내 정보 + 캘린더 연결 관리 + 알림 설정 + 다크모드 + 결제 내역 + 약관·탈퇴

---

## §5. 화면별 기능 명세

### 5.1. 홈 — 캘린더 + 내 일정 + 모임

월간/주간 전환 가능한 캘린더에 내 일정과 모임 일정을 모두 표시. 일정은 출처별 색상으로 구분된다.

기능:
- **캘린더 영역**: 월간/주간 토글, 좌우 스와이프로 월·주 이동
- **일정 표시**: 출처별 색상 (모임 / Google Calendar / Apple Calendar / 에브리타임 / 수동 입력)
- **다가오는 일정 카드**: 오늘·이번 주 일정 미리보기
- **일정 클릭 시**: 일정 상세 모달 (제목·시간·장소·출처)
- **모임 일정 클릭 시**: §5.4 모임 상세로 직접 이동
- **캘린더 영역 우상단 "지도로 보기" 토글**: §5.7의 "지도로 내 일정 보기" 모드 진입
- **캘린더 출처 필터**: 어떤 캘린더 일정을 표시할지 토글 (Google·Apple·에브리타임·모임·수동 개별 ON/OFF)
- 다크모드 자동 적용

### 5.2. 친구 / 내 모임

탭 내부에 두 섹션 — 친구 목록 + 모임 목록.

#### 친구 목록
- 친구 카드 (프로필 이미지·이름·최근 모임 횟수 등)
- 친구 추가: 전화번호·닉네임 검색 (검색 결과는 사용자 동의된 정보만)
- 친구 요청 받기·보내기·수락·거절 (요청 알림 F1·F2)
- **친구 프로필 모달**: 신고 / 차단 메뉴 포함

#### 내 모임 목록
- 호스트 / 멤버로 참여 중인 모임 모두 표시
- 모임 상태별 정렬 (진행 중 / 확정 / 종료)
- 카드 클릭 시 §5.4 모임 상세로 이동
- **모임 멤버 롱프레스 시**: 신고 / 차단 / (호스트인 경우) 강퇴 메뉴

### 5.3. 모임 만들기

(+) FAB → 모임 만들기 화면.

기능:
- **모임 이름** 입력
- **후보 날짜 선택**: 1~7일 다중 선택 (캘린더 모달)
- **시간 그리드**: 15분 단위, 09:00~24:00 (60슬롯/일), 호스트 본인의 가능 시간 먼저 표시
- **친구 초대**: 앱 내 친구 목록 다중 선택 + 카톡 공유 링크 생성
- **게스트 초대 링크**: 별도 토글로 비회원 참여 가능 (브라우저 토큰 기반)
- **카톡 공유 메시지**: OG 미리보기 포함

### 5.4. 모임 상세 + 시간 투표

모임의 핵심 화면. 시간 투표 → 확정 → 장소·예약으로 흐르는 단일 진입점.

#### 상단
- 모임 이름, 호스트 정보, 멤버 수 (회원 + 게스트), 모임 상태

#### 시간 투표 영역
- **후보 날짜·시간 그리드** (15분 단위, 09:00~24:00)
- **드래그 멀티 셀렉트**: 꾹 누르고 sweep 제스처로 가능 시간 표시
- **실시간 히트맵**: Supabase Realtime으로 다른 멤버의 가능 시간 합산 표시 (셀이 진해질수록 더 많은 사람 가능)
- **베스트 타임 1·2·3순위**: 자동 계산 (전원 가능 시간 우선 + 슬롯 길이 우선)
- 60fps 유지 (React.memo + 가상 스크롤, Reanimated)

#### 시간 확정 (호스트 권한)
- 호스트가 베스트 타임 중 하나 또는 임의 선택해 확정
- 확정 시:
  - 멤버에게 푸시 알림 F5
  - Google/Apple 외부 캘린더에 자동 push (부분 양방향 동기화)
  - 모임 상세에 새 섹션 "장소 정하기" 노출

#### 장소 정하기 섹션 (시간 확정 후만 노출)
- `[장소만 정하기]` — 일반 검색 → 카톡 공유로 완료
- `[예약하기]` — 명시적 액션, 지도로 진입 → 제휴 식당 마커 강조 → 결제 흐름 (§5.7 예약 흐름)

#### 멤버 영역
- 회원 멤버 + 게스트 목록, 투표 완료 표시
- 친구 추가 초대 액션

#### 코멘트 영역
- 회원 멤버끼리의 텍스트 코멘트
- 알림 발송 없음 (의도적 — 알림 폭격 방지)

#### 방장 더보기 메뉴
- 호스트:
  - 모임 이름 변경
  - 멤버 강퇴
  - 모임 삭제 (확정 메시지 포함)
- 멤버:
  - 모임 나가기
- (차기 버전: 호스트 위임)

### 5.5. 게스트 투표 (웹 fallback)

카톡 링크로 진입한 비회원이 시간 투표만 할 수 있는 웹 페이지 (Vercel 호스팅, Next.js).

기능:
- 모임 이름·후보 날짜 표시
- **닉네임 입력 모달** (첫 진입 시)
- **브라우저 토큰** 발급 → localStorage 저장
- 시간 그리드 + 드래그 (15분 단위, 09:00~24:00 — 앱과 완전 동기화)
- 실시간 히트맵 (Supabase Realtime, 회원·게스트 합산)
- 투표 완료 후:
  - "결과 알림 받고 모임 만들려면 →" CTA
  - Branch.io 링크 (앱 스토어 + attribution 토큰 동봉)
- 카톡 OG 미리보기 위한 메타 태그
- 회원·앱 사용자보다 기능 제한 — 결과 확인·예약·푸시 알림 등은 앱에서

### 5.6. 친구 초대 수락 (딥링크)

카톡으로 받은 친구 추가 링크 → 앱 또는 Universal Link로 진입.

기능:
- 초대장 모달 (초대자 프로필·메시지)
- 수락 → 친구 목록에 자동 추가, 알림 F2 발송
- 거절 → 일반 거절 (재요청 가능)

### 5.7. 지도 + 예약 — 주력 영역

#### 일반 지도 모드 (지도 탭 진입 시)
- **네이버 지도 SDK** (`@mj-studio/react-native-naver-map`, 2.4+) — `isNightModeEnabled` prop으로 라이트/다크 자동 전환, `isExtentBoundedInKorea`로 한국 영역 제한
- **동적 매장 마커**:
  - 사용자가 지도 이동 → viewport 중심 좌표 + 반경 계산
  - 카카오 Local API 호출 (카테고리별: FD6 음식점, CE7 카페, SW8 지하철역, AT4 관광명소 등)
  - 응답 매장을 우리 `partnerships` DB와 매칭 (`kakao_place_id` 기준)
  - 제휴 매장: **색 + 크기 강조** — 보라 #7C3AED, 1.3~1.5배 크기, 배지 없음
  - 비제휴 매장: 기본 회색 마커
- **카테고리 필터**: 제휴 / 음식점 / 술집 / 파티룸 / 지하철역 (다중 선택 토글)
- **반경 조절 바**: 화면 우측 (현재 위치 기준 검색 반경 조절)
- **클러스터링**: 줌 아웃 시 마커 묶기 ("음식점 23곳")
- API 호출 최적화: 300~500ms debounce + viewport 격자 캐싱 (5분)

#### "지도로 내 일정 보기" 모드 (홈 캘린더에서 토글로 진입)
- 매장 검색 모드 OFF (카카오 Local API 호출 안 함)
- 일정 데이터 (위치 좌표 포함된 일정만):
  - 모임 일정: `groups.confirmed_place_id` → places 좌표
  - Google Calendar 일정: `event.location` → geocoding (차기 버전 — 베타에선 모임 일정만)
  - Apple Calendar: `EKEvent.location` (차기 버전 — 베타에선 모임 일정만)
- 마커 시각화: **숫자 배지 + 폴리라인**
  - 시간 순서대로 ①②③… 번호
  - 보라 #7C3AED 점선 2pt로 마커 간 연결
  - 마커 5개 초과 시 폴리라인 자동 숨김 (가장 가까운 두 점만 연결)
- 시간 범위 선택: 오늘 / 이번 주 / 이번 달

#### 예약 흐름 (모임 확정 후 "예약하기" 진입 시 — 명시적 호스트 액션)

##### Phase 1+2 (활성) — click-through 측정만
1. 지도 모드 + 제휴 식당 마커 강조
2. 마커 클릭 → 바텀시트:
   - 식당명 / 사진 / 카테고리 / 평점 / 영업시간
   - **₩20,000 보증금** 안내 + 환불 정책 짧게 (display only)
   - 두 CTA:
     - `[장소만 정하기]` → 카톡 공유 → 종료
     - `[예약하기]` → **click event 로깅** + "Phase 1+2: 준비 중" 안내 (또는 silent, founder 선택) → 종료
3. Click 이벤트 schema: `event_id`, `user_id`, `group_id`, `place_id`, `partnership_id`, `clicked_at`, `segment_label` (P1/P2). **Gate #2 측정의 단일 source of truth** ([S08](TASK_BACKLOG.md#s08--예약하기-click-through-측정))

##### 🔒 Phase 3 (Gate #2 ≥25% 통과 시 commit)
3. 결제 흐름:
   - 토스페이먼츠 결제 위젯 (WebView 통합)
   - 카드 / 카카오페이 / 네이버페이 / 토스페이 / 계좌이체
   - 결제 성공 시:
     - 호스트에게 푸시 F6
     - 모임 상세에 "예약 완료" 카드
4. 식당 측 처리:
   - 우리 partnerships DB에 예약 row 추가
   - 식당 사장님께 운영팀 카톡 채널로 통지 (베타 단계 manual, 차기 버전 알림톡 자동화)
5. 모임 시간 1시간 전 푸시 F7 (호스트 + 멤버)

### 5.8. 로그인 / 프로필 / 온보딩

#### 로그인 흐름
- 카카오 OIDC OAuth (Supabase `signInWithIdToken` — [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede))
- **약관/개인정보 동의 모달** (필수) + 마케팅·위치 동의 (선택)
- 첫 로그인 시 온보딩으로 자동 진입

#### 온보딩 (3 슬라이드 미니)
- 카카오 로그인 직후, 첫 실행 시만 노출
- 슬라이드:
  1. "친구와 시간 맞추기" — 시간 그리드·히트맵 GIF
  2. "함께 갈 장소 찾기" — 지도·필터 GIF
  3. "예약까지 한 번에" — 보증금 모델 설명
- 스킵 가능

#### 프로필
- 내 정보 (이름·이메일·프로필 이미지)
- **연결된 캘린더 관리**: Google + Apple iOS (네이버는 차기 버전)
  - 동기화 ON/OFF
  - "어디에 추가할까요?" — 첫 모임 확정 시 묻고 기억, 프로필에서 변경 가능
- **알림 설정**: 3개 카테고리 토글 (소셜 / 모임 / 예약), 디폴트 ALL ON
- **다크모드 설정**: 시스템 자동 (기본). 수동 토글은 차기 버전
- **결제 내역**: 예약 결제 내역 + 환불 내역
- **약관 및 정책**: 이용약관 / 개인정보처리방침 / 결제약관
- **계정 탈퇴**:
  - 진행 중 모임 있으면 경고
  - 미정산 결제 있으면 차단 또는 환불 진행 후
  - 30일 deactivate → 자동 삭제 (개인정보보호법 준수)

---

## §6. 도메인 모델

### 6.1. 코어 도메인

#### `users`
- 사용자 기본 정보, 카카오 OIDC `sub` claim(`kakao_id`) + `email` nullable (베타 미수집, Phase 3 비즈앱 후 채움 — [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede))
- 노쇼 페널티 카운터 (`no_show_count`)

#### `friendships`, `friend_requests`
- 양방향 친구 관계 + 요청 큐
- `blocks` 테이블과 연계해 차단 시 친구 추천에서 자동 제외

#### `groups`
- 모임 코어
- `confirmed_at` (timestamp, 시간 확정 시각)
- `confirmed_place_id` (장소 확정 시 places ref)
- `reservation_id` (예약 시 reservations ref, nullable)

#### `group_members`, `group_guests`
- 회원 멤버와 게스트 분리
- 알림·통계에서 "참여자" = group_members로 한정 (F4 알림 등)

#### `group_invitations`
- 친구 초대 + 게스트 초대 링크
- 토큰 기반

#### `votes`, `time_slots`
- 시간 투표
- 15분 단위 슬롯 (분 단위 저장이라 schema 자체엔 단위 명시 없음)
- 클라이언트 상수: `SLOT_DURATION_MINUTES: 15`, `GRID_START_HOUR: 9`, `GRID_END_HOUR: 24`

#### `places`
- 매장 정보 캐시 (카카오 Local API 응답 캐싱)
- `partnership_id` FK → partnerships (nullable)

#### `schedules`
- 사용자 일정 (개인 + 모임 통합)
- `source` enum: `'manual' | 'google' | 'apple_ios' | 'everytime'` (차기: `'naver'`)
- `location_lat`, `location_lng` (지도 표시용, nullable)
- `external_event_id` (Google/Apple 동기화 식별자, push 시 사용)
- `pushed_to_external` (boolean — 앱 → 외부 push 여부)

#### `comments`
- 모임 상세 코멘트
- 알림 발송 없음 (의도적)

### 6.2. 결제·예약 도메인

#### `partnerships`
```
id                  uuid PK
place_id            uuid FK → places
kakao_place_id      varchar(50) UNIQUE (카카오 매장 ID, 매칭 키)
business_number     varchar(20) (사업자번호)
business_name       varchar(100)
representative_name varchar(50)
contact_phone       varchar(20)
contact_kakao_id    varchar(50)
payout_account      jsonb {bank, account_number, holder_name}
operating_hours     jsonb [{day, open, close}]
holidays            jsonb [date or weekday]
max_group_size      int
category            enum('restaurant', 'bar', 'party_room')
photos              jsonb [url]
signature_menu      jsonb
price_range         enum (참고용)
status              enum('active', 'paused', 'terminated')
contract_signed_at  timestamp
settlement_schedule enum('biweekly_1_15', ...)
created_at, updated_at
```

#### `reservations`
```
id                  uuid PK
group_id            uuid FK → groups
partnership_id      uuid FK → partnerships
host_id             uuid FK → users
reserved_for        timestamp (모임 예정 시각)
status              enum('pending', 'confirmed', 'completed', 'no_show', 'cancelled', 'refunded')
created_at, updated_at
```

#### `payments`
```
id                  uuid PK
reservation_id      uuid FK → reservations
amount              int (20000)
our_fee             int (1500, 베타 고정 — 차기 가변)
partner_payout      int (18500, 베타 고정)
toss_payment_key    varchar(200) (토스페이먼츠 식별자)
toss_order_id       varchar(100)
status              enum('ready', 'in_progress', 'done', 'cancelled', 'partial_cancelled', 'aborted', 'expired')
method              enum('card', 'kakaopay', 'naverpay', 'tosspay', 'transfer', ...)
paid_at             timestamp
refunded_at         timestamp (nullable)
refund_amount       int (nullable)
refund_reason       text (nullable)
created_at, updated_at
```

#### `payouts` (정산)
```
id                  uuid PK
partnership_id      uuid FK → partnerships
period_start        date
period_end          date
total_amount        int (해당 기간 정산 총액)
payment_ids         uuid[] (해당 정산에 포함된 payments)
status              enum('pending', 'paid', 'failed')
paid_at             timestamp (nullable)
tax_invoice_number  varchar(50) (세금계산서 번호)
created_at, updated_at
```

### 6.3. 알림·운영 도메인

#### `push_tokens`
```
id              uuid PK
user_id         uuid FK → users
expo_push_token varchar(200)
platform        enum('ios', 'android')
device_id       varchar(100)
created_at, updated_at, last_used_at
```

#### `notification_settings`
```
user_id           uuid PK FK → users
social_enabled    boolean DEFAULT true  -- F1, F2, F3
group_enabled     boolean DEFAULT true  -- F4, F5
reservation_enabled boolean DEFAULT true -- F6, F7
created_at, updated_at
```

#### `reports` (신고)
```
id              uuid PK
reporter_id     uuid FK → users
reported_user_id uuid FK → users
group_id        uuid FK → groups (nullable, 모임 컨텍스트일 때)
reason          enum('spam', 'inappropriate', 'fraud', 'other')
description     text
status          enum('pending', 'reviewing', 'resolved', 'dismissed')
created_at, resolved_at
```

#### `blocks` (차단)
```
id              uuid PK
blocker_id      uuid FK → users
blocked_id      uuid FK → users
created_at
```

#### `branch_attributions` (게스트→회원 전환)
```
id                uuid PK
branch_link_id    varchar(100) (Branch.io에서 생성된 attribution ID)
guest_token       varchar(100) (브라우저 게스트 토큰)
group_id          uuid FK → groups
created_at        timestamp
converted_at      timestamp (nullable, 회원가입 시 매칭된 시각)
converted_user_id uuid FK → users (nullable)
```

---

## §7. 외부 연동

### 7.1. 카카오

| 용도 | 처리 |
|---|---|
| 카카오 OIDC OAuth | Supabase `signInWithIdToken` 표준 flow. 비즈앱·이메일 권한은 Phase 3 ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede)) |
| 카카오톡 공유 | 모임 초대·결과 공유 + OG 미리보기 (Vercel 웹) |
| **카카오 Local API** | 단독 사용 — 네이버 지도 위에 마커 그리기 (좌표만 활용, 매장 데이터 한국 최강) |

⚠️ **확인 필요**: 카카오 Local API 약관상 "카카오맵 외 지도에 표시" 명시적 금지 여부 — 정식 출시 전 카카오 측 확인 (§16-6).

### 7.2. 지도 SDK — 네이버 지도

v1.0 출시는 **`@mj-studio/react-native-naver-map` (2.4+, 네이티브 SDK)**. Expo CNG (Continuous Native Generation) 공식 지원, iOS·Android·new/old arch·debug/release 8가지 조합 모두 테스트됨. 검색은 카카오 Local API 그대로 사용 (한국 매장 데이터의 풍부함).

**Mapbox 초기 검토 후 변경 이력**: Mapbox(`@rnmapbox/maps`)를 초기에 채택했으나 한국 도로·작은 골목 데이터 한계가 명확해 네이버 지도로 변경. OSM 기반 Mapbox는 한국 시장 적합성 ↓.

### 7.3. Google Calendar

- API: events.list + events.insert + events.update + events.delete (OAuth scope `calendar.events`)
- 백엔드(Supabase Edge Function)에서 refresh_token으로 모든 멤버에게 push 가능
- 모임 확정 시 자동 push, 외부 수정/삭제 동기화는 X (단순화)

### 7.4. Apple Calendar (iOS only)

- `expo-calendar` 패키지 사용 (EventKit wrapper)
- iOS 17+ 권한 세분화: write-only 권한만 요청 가능 (사용자 마찰 ↓)
- 읽기: `getEventsAsync` — 디바이스 등록 모든 캘린더 계정 (iCloud + Google + Outlook + 네이버 iOS 앱 등) 통합 접근
- 쓰기: `createEventAsync` — 사용자가 첫 모임 확정 시 "어느 캘린더에 추가할까요?" 묻고 기억
- Android에서는 옵션 자체 노출 X (iCloud 없음)

### 7.5. 네이버 캘린더 (차기 버전)

- API: `https://openapi.naver.com/calendar/createSchedule.json` (push 전용)
- 조회 API 없음 → 단방향 (앱 → 네이버) 만 가능
- v1.0에서는 미포함, 차기 버전에 추가

### 7.6. 에브리타임 OCR

- Google Gemini Vision API
- 학교 시간표 스크린샷 OCR
- 학기 시작일·종료일 입력 모달
- 매주 반복 일정 자동 생성, 학기 종료 자동 만료

### 7.7. 토스페이먼츠

- 결제 위젯 (WebView 통합)
- 분할정산 (서브머천트 모델): 우리 = 마스터 가맹점, 식당 = 서브머천트
- 결제 수단: 카드 / 카카오페이 / 네이버페이 / 토스페이 / 계좌이체
- 에스크로 후 정산 (모임 시점 + 1일 후)

### 7.8. Branch.io

- Deferred deeplink + install attribution
- 카톡 게스트 페이지 → 앱 설치 → 게스트 토큰 자동 매칭
- 무료 티어 ~10K MAU, 이후 유료 ($59~/월)

### 7.9. Expo 푸시 알림

- `expo-notifications` + Expo Push Service
- Supabase Edge Function에서 트리거 (이벤트 후 즉시 발송)
- 페이로드 예시: `{ screen: 'group/[id]', params: { id } }`

---

## §8. 결제·정산 시스템 🔒 Phase 3

> ⚠️ **§8 전체는 🔒 Phase 3.** Phase 1+2은 "예약하기" click event 로깅만(§5.7 Phase 1+2 섹션). 본 §8의 토스페이먼츠 통합·환불·정산·세금계산서·통신판매업 신고는 모두 Gate #2(≥25%) 통과 시 commit. → [G2](DECISIONS.md#g2--gate-2-장소-확정--예약하기-click-through--가장-critical)

### 8.1. 결제 흐름 🔒 Phase 3

```
[모임 확정]
  → 호스트가 지도에서 제휴 식당 선택
  → "예약하기" 버튼 (명시적 액션)
  → 토스페이먼츠 결제 위젯 (20,000원)
  → 결제 성공 시:
       - reservations 테이블 'confirmed' 상태로
       - payments 테이블 'done' 상태로
       - 호스트에게 F6 푸시 알림
       - 식당 운영팀 카톡 채널로 manual 통지
       - 모임 1h 전 F7 푸시 알림 예약 (Supabase Cron)
```

### 8.2. 환불 흐름 🔒 Phase 3

| 시점 | 환불 비율 | payments.status |
|---|---|---|
| 모임 24h 전 취소 | 100% | `cancelled` |
| 모임 1~24h 전 취소 | 50% | `partial_cancelled` |
| 모임 1h 이내 또는 노쇼 | 0% | (status 변경 없음, no_show 처리) |
| 식당 측 사정 무산 | 100% + 식당 측 위약금 (정산에서 차감) | `cancelled` |

환불 트리거는 사용자가 모임 상세에서 "예약 취소" → 시점 자동 계산 → 확인 모달 → 토스페이먼츠 환불 API 호출.

### 8.3. 정산 흐름 🔒 Phase 3

- 정산 주기: **격주 1·15일** (월 2회)
- 정산 시점: 모임 시점 + 1일 후 payments → payouts로 그룹화
- 정산 시 식당에 자동 이체 (사업자 계좌 등록 기준)
- 세금계산서 자동 발행 (전자세금계산서 API 연동 — v1.0 P0)
- 노쇼 페널티는 정산엔 영향 없음 (BM 본질이 보증금이라 식당에 자동 정산)

### 8.4. 사전 셋업 작업 🔒 Phase 3 (Gate #2 통과 후 시작)

| 작업 | 기간 | 비고 |
|---|---|---|
| 사업자등록증 | 이미 보유 가정 | 개인사업자 또는 법인 |
| 통신판매업 신고 | 5~7영업일 | 관할 구청 |
| 토스페이먼츠 가맹 심사 | 1~2주 | 사업자 + 통신판매업 필요 |
| 정산용 사업자 계좌 | 1~2일 | 사업자등록증으로 개설 |
| 약관·개인정보처리방침·결제약관 | 1~2주 | 변호사 검토 권장 |
| 식당 영업·계약 자료 (소개서·계약서·정산 시뮬레이션) | 1주 | 영업팀 무장 |
| 식당 manual 영업 | 4~6주 | 출시 시점 20곳 목표 |

---

## §9. 푸시 알림

### 9.1. P0 알림 — 7종

| # | 이벤트 | 대상 | 카테고리 | 페이로드 |
|---|---|---|---|---|
| F1 | 친구 요청 받음 | 받은 사람 | 소셜 | `friends` 탭 |
| F2 | 친구 요청 수락됨 | 보낸 사람 | 소셜 | `friends` 탭 |
| F3 | 모임 초대 받음 | 초대받은 사람 | 소셜 | `group/[id]` |
| F4 | 모든 참여자 투표 완료 | 호스트 only | 모임 | `group/[id]` |
| F5 | 호스트 시간/장소 확정 | 회원 멤버 (게스트 제외) | 모임 | `group/[id]` |
| F6 | 예약 완료 | 호스트 | 예약 | `group/[id]/reservation` |
| F7 | 예약 시간 임박 (1h 전) | 호스트 + 회원 멤버 | 예약 | `group/[id]` |

### 9.2. "참여자" 정의 (F4용)
- **`group_members`만 카운트** (호스트가 초대한 멤버)
- `group_guests` (링크로 들어온 게스트)는 제외 (게스트는 늦게 들어와 끝없이 미뤄질 위험)
- "투표 완료" = votes 테이블에 row 1개 이상 (가능 시간 0개여도 의사 표시는 완료)
- 한 모임당 F4 알림 1회 (idempotent)

### 9.3. 알림 설정 UI
- 프로필 → 알림 설정
- 3개 카테고리 토글: 소셜 / 모임 / 예약
- 디폴트 ALL ON
- 시스템 알림 권한 거부 시 안내 모달

### 9.4. 차기 버전 추가 후보
- F8 예약 취소/환불 (호스트)
- 일정 시작 알림 (네이티브 캘린더 알림으로 대체 가능해 약함)
- 마케팅 알림 (별도 동의 필수, 디폴트 OFF)

---

## §10. 디자인 시스템

### 10.1. 디자인 톤
- 토스 풍 절제된 디자인
- 보라 #7C3AED 포인트
- **그라데이션·글래스모피즘 금지**
- 둥근 모서리·여백·타이포 위계로 표현

### 10.2. 다크모드
- **시스템 자동 감지** (P0) — iOS/Android 설정 따라
- 수동 토글 (차기 버전)
- 컬러 토큰 두 세트:
  - 라이트: 화이트 배경 + 보라 강조 + 회색 보조
  - 다크: 다크 배경 (#0F0F12 등) + 보라 강조 약간 밝게 조정 (#9B7AFF) + 회색 보조
- 마커·차트·맵 스타일도 다크 자동 대응 (네이버 지도 SDK `isNightModeEnabled` prop으로 자동 전환)

### 10.3. 핵심 컴포넌트
- 시간 그리드 (셀 8pt, 60슬롯 세로 = 480pt)
- 실시간 히트맵 셀 (진해질수록 사람 많음)
- 제휴 마커 (보라 #7C3AED, 1.3~1.5배 크기, 배지 없음)
- 예약 바텀시트 (식당 정보 + 보증금 안내 + 환불 정책 + 결제 CTA)
- 동선 폴리라인 (보라 #7C3AED 점선 2pt)
- 결제 상태 카드 (모임 상세 내)
- 신고/차단 메뉴 (회색 톤, 절제)

---

## §11. 기술 스택

### 11.1. 클라이언트
- **React Native + Expo SDK 53+**
- **TypeScript**
- **expo-router** (App Router 패턴)
- **Zustand** (전역 상태) + **TanStack Query** (서버 상태·캐싱)

### 11.2. 지도·장소
- **`@mj-studio/react-native-naver-map`** (네이버 지도 RN SDK, Expo CNG 공식 지원, 2.4+ 새 Naver Maps 상품 지원)
- **카카오 Local API** (REST, 매장 검색용)

### 11.3. 캘린더
- **`expo-calendar`** (EventKit + CalendarProvider wrapper)
- **Google Calendar API v3** (events.list + insert + update + delete)

### 11.4. 결제
- **토스페이먼츠 결제 위젯** (WebView 통합)
- 분할정산 (서브머천트 모델)

### 11.5. 알림
- **`expo-notifications`** + **Expo Push Service**
- Supabase Edge Functions로 트리거

### 11.6. Attribution
- **Branch.io SDK** (`react-native-branch`)

### 11.7. 백엔드
- **Supabase** — Postgres + Auth + Realtime + Edge Functions + Storage
- **Vercel** — 웹 게스트 페이지 + 카톡 OG 미리보기

### 11.8. AI
- **Google Gemini Vision API** — 에브리타임 시간표 OCR

---

## §12. P0 / P1 / 폐기 우선순위

### 12.1. P0 (v1.0 출시 시점 동작 필수)

#### 사용자·인증
- 카카오 OIDC OAuth ([D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede))
- 약관/개인정보 동의 모달 (필수 + 마케팅·위치 선택)
- 탈퇴 흐름 (30일 deactivate → 자동 삭제)
- 신고/차단 (운영팀 카톡 채널 수신)

#### 일정·모임
- 15분 시간 그리드, 09:00~24:00 (60슬롯/일)
- 드래그 멀티 셀렉트 + 실시간 히트맵
- 모임 만들기 → 시간 투표 → 확정 → 장소 정하기 흐름
- 방장 메뉴 (이름 변경·강퇴·삭제·나가기)
- 에브리타임 OCR + 학기 입력 UX

#### 지도·예약
- 네이버 지도 SDK + 카카오 Local API
- 카테고리 필터 + 반경 조절 + 동적 마커 + 클러스터링
- 제휴 마커 강조 (색 + 크기)
- 예약 흐름 (명시적 액션 → 토스페이먼츠)
- "지도로 내 일정 보기" (숫자 + 폴리라인)

#### 결제·정산
- 토스페이먼츠 분할정산 (서브머천트)
- 환불 정책 (24h/1h 2단계)
- 정산 자동 (격주 1·15일)
- 세금계산서 자동 발행

#### 동기화·확장
- Google Calendar 부분 양방향 (Read + Push)
- Apple Calendar iOS 부분 양방향 (expo-calendar)
- 게스트→회원 자동 전환 (Branch.io)
- 웹 게스트 페이지 (Next.js Vercel, 15분 그리드 동기화)

#### 알림
- 푸시 알림 7종 (F1~F7)
- 알림 설정 카테고리 토글

#### 디자인·UX
- 다크모드 (시스템 자동)
- 3 슬라이드 미니 온보딩
- 토스 풍 절제 디자인 톤

### 12.2. P1 (차기 버전 — v1.1+)
- 네이버 캘린더 동기화 (push 전용)
- F8 예약 취소/환불 알림
- 다크모드 수동 토글
- 호스트 위임
- 신고 자동 처리 + 운영 어드민 웹
- 식당 셀프 가입 + 식당 어드민 웹
- 카페 카테고리 BM (입점 광고·월 구독료 등)
- 카테고리/인원수별 가격 차등
- 자동 노쇼 판정 (식당 어드민 출석 체크 또는 알림톡 응답)
- 동선 폴리라인 마커 5개 초과 케이스 (지금은 자동 숨김)
- Google·Apple 캘린더 일정의 location 좌표 표시 ("지도로 내 일정 보기" 확장)
- Promoted listing (지도 상단 광고)
- 프리미엄 사용자 구독

### 12.3. 폐기 (검토 후 도입 안 함)
- Memories(추억 기록) — 베타 우선순위에서 제외, 차기 별도 재검토
- 데스크톱 폭 제한 (모바일·태블릿만 지원)
- 외부 예약 API 직결 (네이버 예약·캐치테이블 등) — 자체 결제 BM이라 불필요

---

## §13. 출시 전략 — β-compact Phased Rollout

> 2026-05-21 의사결정: 5개 검증 안 된 premise(P1~P5)에 동시 베팅 회피. Phase 1+2 묶음 모바일 출시 → Gate 통과 시 Phase 3 commit.
> 원본 의사결정 기록: [archive/OFFICE_HOURS_DESIGN_2026-05-21.md §9](archive/OFFICE_HOURS_DESIGN_2026-05-21.md)

### 13.1. Phase 1+2 Scope (모바일 첫 출시, 3.5주) — 활성

**클라이언트 (포함):**
- RN/Expo SDK 53+
- 카카오 OIDC OAuth (Supabase signInWithIdToken) — [D29](DECISIONS.md#d29--kakao-oidc-oauth-via-supabase-signinwithidtoken-d21-supersede). [D21](DECISIONS.md#d21--kakao-oauth-synthetic-email--hmac-베타는-카카오-only) supersede (2026-05-22). 비즈앱 등록 + `account_email`은 Phase 3
- 시간 그리드 + 실시간 히트맵 — 60fps Reanimated worklet, Edge Function aggregation ([D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b), [D12](DECISIONS.md#d12--60fps-시간-그리드-구현-spec))
- 캘린더 동기화 (Google + Apple iOS via expo-calendar) — 단방향, 부분 실패 명시 ([D19](DECISIONS.md#d19--calendar-sync-단방향-부분-실패-명시))
- 네이버 지도 SDK + 카카오 Local API + 카테고리 필터·반경·동적 매장 검색·제휴 마커 강조
- **"예약하기" click-through 측정만** (실제 결제 X, 토스 가맹 X)
- 식당 20곳 정보 **display only** (no booking flow, partnerships table read-only)
- 푸시 F1-F5 (소셜 + 모임). F6·F7 = 🔒 Phase 3
- 다크모드 시스템 자동 ON ([D6](DECISIONS.md#d6--다크모드--시스템-자동-독립-디자인)). 디테일 검증은 🔒 Phase 3 ([D2](DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce))
- 약관·개인정보 동의 모달
- 에브리타임 OCR ([D2](DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce) keep)
- "지도로 내 일정 보기" 모드 ([D2](DECISIONS.md#d2--phase-12-scope-reduction-다크-디테일만-reduce) keep)

**백엔드 (포함):**
- 새 Supabase project (prior MVP 별도 운영)
- 새 schema 설계 — Phase 1+2은 `partnerships`만, reservations/payments/payouts는 🔒 Phase 3 ([D3](DECISIONS.md#d3--phase-3-schema-설계-시점-옵션-b--partnerships-only))
- Edge Functions for 푸시 알림 + 히트맵 aggregation
- 30명 prior MVP user는 새 앱 transition (카톡 환영 메시지 + 닉네임 기억)

**🔒 Phase 3 비포함 (현재):**
- 토스페이먼츠 결제 위젯
- 통신판매업 신고
- 변호사 약관 검토
- 식당 활성화 (사인 → 첫 결제 trigger)
- 실제 예약·정산·환불·노쇼 flow
- 푸시 F6·F7 (예약)

### 13.2. Decomposed Gate (Gate #1 + Gate #2)

→ 상세: [G1](DECISIONS.md#g1--gate-1-모임-확정--장소-확정-비율) · [G2](DECISIONS.md#g2--gate-2-장소-확정--예약하기-click-through--가장-critical)

```
Phase 2 launch (W0)
  ↓
W0-W2: baseline 수집 (gate 적용 X)
  ↓
W2: 자체 data로 gate threshold final calibrate
  ↓
W2-W8: gate monitoring
  ↓
Gate #1 (모임 확정 → 장소 확정 비율):
  ≥ 40% → 강한 신호
  20-39% → 보류 (UX 개선 + 2주 추가 측정)
  < 20% → 장소 기능 가설 무너짐

Gate #2 (장소 확정 → "예약하기" click-through):
  ≥ 25% → 강한 신호
  10-24% → 보류 (P1 학생 vs P2 직장인 segment 분리 측정)
  < 10% → cold read framing 검증 — coordination-only reframe 결정

Combined:
  Gate #1·#2 모두 강한 → Phase 3 full commit
  하나만 강한 → 약한 단계 진단 + 부분 commit
  둘 다 보류 → Phase 2 연장 + segment 분리
  Gate #2 < 10% → 3-path 결정:
    (a) Coordination-only product reframe
    (b) 식당 20곳 timeline 재조정 communication
    (c) P2 segment 별도 acquisition으로 재시도
```

진행 추적: [PROGRESS.md](PROGRESS.md) KPI 섹션

### 13.3. 식당 Retention 패키지

**Incentive:**
- 사인비 ₩0 (기존)
- 활성화 D-day 명시: "Phase 2 검증 후 8주 이내"
- 활성화 후 첫 3개월 수수료 0% (베타 1500원 → 0원)
- 활성화 시 베타 우선 노출 (지도 상단 / 카테고리 첫 결과)

**Communication cadence:**
- 월 1회 progress update (12주 × 1회 = 3-4회)
- 활성화 D-day 2주 전 final notice
- 운영팀 카톡 채널 1:1 SLA 48h (§17.2)

**Fail mode (Pre-mortem):**
- Gate #2 < 10% 시나리오에 대한 식당 communication script 미리 작성 ([Q-A5](OPEN_QUESTIONS.md#q-a5--pre-mortem-communication-script-gate-2--10-시))
- 3-path 결정 시 식당 영향 분석 + 시점별 대응

### 13.4. 🔒 Phase 3 — Gate 통과 시 commit (8-12주 추정)

순서:
1. 토스페이먼츠 가맹 심사 (1-2주)
2. 통신판매업 신고 (5-7영업일, 관할 구청)
3. 변호사 약관 검토 (1-2주)
4. 사업자 계좌 + 정산용 인프라
5. 식당 활성화 (20곳 사인 → 첫 결제 trigger 활성)
6. 실제 예약·결제·정산·환불·노쇼 flow 활성
7. 푸시 F6·F7 (예약) 활성
8. Apple ID 로그인 정식 추가 (App Store guideline 4.8)
9. 다크모드 디테일 검증 (마커·차트·맵 두 톤 일치)

### 13.5. 차기 버전 (v1.1+, Phase 3 활성 후 ~2~3개월)
- 베타 지역·카테고리 확장
- 네이버 캘린더 추가
- 식당 셀프 가입 + 어드민 웹 출시
- 자동 노쇼 판정 인프라
- **수익 다층화 시작** (§2.4 참고):
  - 카테고리·가격대별 차등 수수료 도입 (파인다이닝·룸 등)
  - 카페 카테고리 BM 별도 도입 (입점 광고 + 월 구독료)
  - Promoted listing 시작
  - 프리미엄 사용자 구독 ("된다 프리미엄") 검토

---

## §14. 사용자 흐름

### 14.1. 새 사용자 — 친구 따라 게스트 참여 → 회원 전환
```
카톡으로 모임 초대 링크 받음
  → 웹 게스트 페이지 열림 (15분 그리드, 앱과 동일)
  → 닉네임 입력 + 시간 투표
  → 투표 완료 화면에 "결과 알림 받고 모임 만들려면 →" CTA
  → 클릭 시 Branch.io 링크 (앱 스토어 + attribution)
  → 앱 설치 + 카카오 로그인
  → 약관 동의 + 3 슬라이드 온보딩
  → Branch.io attribution 매칭 → 게스트 토큰 → 회원 ID로 슬롯 마이그레이션
  → 그 모임 정식 멤버로 자동 합류
```

### 14.2. 기존 호스트 — 모임 만들기부터 예약까지
```
홈 → (+) 탭 → 모임 만들기 (이름·후보 날짜·시간 그리드 09:00~24:00)
  → 친구 초대 (앱 내 + 카톡 공유)
  → 친구들 시간 투표 (실시간 히트맵)
  → F4: 호스트에게 "모두 투표 완료" 푸시
  → 호스트가 시간 확정
  → F5: 멤버에게 푸시 + Google/Apple Calendar에 자동 push (부분 양방향)
  → 모임 상세에 "장소 정하기" 섹션:
       [장소만 정하기] 또는 [예약하기]
  → 호스트가 "예약하기" 선택
  → 지도 모드 → 카테고리 필터·반경 조절
  → 제휴 식당 마커 강조 (색+크기) → 클릭 → 바텀시트 → "예약하기"
  → 토스페이먼츠 결제 (20,000원)
  → F6: 호스트에게 "예약 완료" 푸시
  → 운영팀 → 식당 사장님께 카톡 1:1 통지 (베타 manual)
  → 모임 1h 전 F7: 호스트+멤버에게 시간 임박 푸시
  → 모임 발생
  → +1일 후 식당 정산 (격주 1·15일)
```

### 14.3. 노쇼 발생 흐름
```
모임 시간 지나도 식당에서 신고 없음 → 정상 처리
  → 호스트·식당 모두 정산받음
또는
모임 시간 후 식당에서 카톡 1:1로 "노쇼" 신고
  → 운영팀이 reservations.status = 'no_show'로 수동 업데이트
  → 호스트의 노쇼 페널티 카운터 +1
  → 5회 누적 시 다음 예약 시 경고 표시 (차기: 일시 제한)
  → 정산은 그대로 진행 (BM 본질이 보증금이라 식당 보장)
```

### 14.4. 환불 흐름
```
사용자가 모임 상세 → "예약 취소" 클릭
  → 시점 자동 계산:
       - 24h 전 → 환불 100% 확인 모달
       - 1~24h 전 → 환불 50% 확인 모달
       - 1h 이내 → 환불 0% (취소 불가 알림)
  → 확인 시 토스페이먼츠 환불 API 호출
  → payments.status = 'cancelled' or 'partial_cancelled'
  → 사용자에게 토스 환불 SMS + 모임 상세에 "예약 취소됨" 표시
```

---

## §15. 비기능 요구사항

### 15.1. 성능
- 시간 그리드 (60슬롯 × 7일 = 420셀, 모임당) 드래그 60fps 유지
- 지도 마커 풍부 시 (50+ 마커) 60fps 유지
- 결제 위젯 로드 < 2초

### 15.2. 안정성
- 토스페이먼츠 결제 idempotency 보장 (중복 결제 방지)
- 푸시 알림 재시도 (Expo Push 실패 시 최대 3회)
- Branch.io attribution 매칭 실패 시 사용자에게 명시적 안내 ("초대받은 모임이 있나요?" 수동 입력 fallback)

### 15.3. 보안
- 결제 PCI-DSS는 토스페이먼츠가 처리
- 사용자 카드 정보 우리 서버 절대 저장 X
- 게스트 토큰·사업자번호·정산 계좌는 암호화 저장 (Supabase Vault)
- API 호출 시 JWT + RLS (Row Level Security)
- OAuth refresh_token은 백엔드 전용 저장

### 15.4. 법적
- 통신판매업 신고 필수
- 전자상거래법 환불·청약철회 정책 명시
- 개인정보보호법 — 탈퇴 시 30일 deactivate then delete
- 결제약관 + 이용약관 + 개인정보처리방침 (변호사 검토)

### 15.5. 접근성
- WCAG 2.1 AA 수준 목표
- 다크모드 contrast 충족
- 시간 그리드 셀 8pt — 실제 사용은 sweep 제스처라 정확도 보완
- 푸시 알림 텍스트 다국어 가능 구조 (베타는 한국어 only)

### 15.6. 운영
- 결제 실패율 모니터링 (Sentry)
- 환불 SLA: 토스페이먼츠 표준 (영업일 3~5일)
- 분쟁 처리 SLA: 운영팀 카톡 채널 응답 48시간 이내

---

## §16. Open Questions

**→ 모든 미해결 질문은 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)로 통합되었다.**

원본 §16의 11개 항목 (§16-1 ~ §16-11)은 OPEN_QUESTIONS.md에 다음 카테고리로 정리되어 있다:
- **A. Pre-build 필수** (Sprint 0 이전): Kakao 정책 답변(Q-A1·Q-A2), Branch.io NAT PoC(Q-A6), 1주 cold read prototype(Q-A3), baseline 측정 design(Q-A4), pre-mortem script(Q-A5)
- **B. Phase 1+2 진행 중** (Sprint 0~4): 모임 트랜잭션 통합(Q-B1, ←§16-1), API 인증(Q-B2, ←§16-2), 푸시 트리거(Q-B3, ←§16-3), 이미지 업로드(Q-B4, ←§16-4), FAB·로고·마커 디자인(Q-B9·B10·B13, ←§16-5), 베타 지역(Q-B16, ←§16-9), 영업 자료(Q-B17, ←§16-10), 운영 SOP(Q-B18, ←§16-11), 기타
- **C. 🔒 Phase 3 deferred** (Gate #2 통과 시): 토스 분할정산 PoC(Q-C1, ←§16-7), 도메인 schema(Q-C2), Apple ID(Q-C3), 다크 디테일(Q-C4)
- **D. 미분류**: 다중 가설 진단 분리(Q-D1)

답이 나오면 [DECISIONS.md](DECISIONS.md)에 새 D{N}으로 옮기고 OPEN_QUESTIONS의 해당 항목은 `Closed by D{N}` 표기.

---

## §17. 영업·운영 인프라

### 17.1. 영업 측 (출시 4~6주 전 시작)
- **영업 인력**: 1~2명 풀타임 (본인 또는 외주)
- **영업 자료**: 식당 대상 소개서, 계약서 템플릿, 정산 시뮬레이션, 등록 가이드
- **베타 식당 목표**: 출시 시점 최소 20곳, 4주 내 50곳
- **계약 시 수집 정보**: 사업자등록증, 정산 계좌, 카카오 place_id, 영업시간, 사진 3~5장, 대표 메뉴, 사장님 카톡 ID

### 17.2. 운영 측
- **운영팀 카톡 채널**: 식당·사용자 양측 1:1 응대 (베타 사이즈에 적합)
- **응대 SLA**: 영업일 기준 48시간 이내
- **수동 처리 항목**:
  - 노쇼 신고 수신 → reservations 상태 수동 업데이트
  - 환불 분쟁 → 환불 처리 또는 식당 위약금 처리
  - 식당 출석 정상 통지 (베타 manual)
  - 신고/차단 검토

### 17.3. 정식 출시 이후 (차기 버전)
- 식당 어드민 웹 (셀프 출석 체크 + 정산 내역 + 세금계산서 다운로드)
- 알림톡 자동 발송 (예약 알림 + 출석 확인)
- 자동 노쇼 판정 인프라
- 운영팀 어드민 페이지 (신고 처리 + 환불 처리 + 식당 관리)

---

## §18. 기존 베타 환경에서의 데이터 마이그레이션

이 제품은 모바일 앱 v1.0이 정식 출시지만, 일부 데이터는 기존 베타·테스트 환경에서 마이그레이션될 수 있다. 마이그레이션 시 호환성:

| 영역 | 호환성 |
|---|---|
| `users`, `friendships`, `groups`, `group_members` | ✅ 100% (스키마 동일) |
| `votes`, `time_slots` (15분/30분 슬롯 혼재 가능) | ✅ 분 단위 저장이라 호환. UI에서 15분 그리드로 표시 |
| `schedules` | ✅ source enum 확장 (`apple_ios` 추가), 기존 데이터 정상 |
| `places` | ✅ `partnership_id` FK 추가 (nullable), 기존 데이터 정상 |
| 기존 베타 시점 확정된 모임 | ✅ 기존 흐름대로 표시 (시간 확정만, 예약·결제는 새로 시작) |
| 기존 베타 게스트 토큰 | ✅ 웹 게스트 페이지에서 그대로 유지 |
| 기존 Google OAuth 토큰 | ⚠️ scope 업그레이드 필요 (`calendar.readonly` → `calendar.events`) — 첫 실행 시 재동의 |

마이그레이션 작업:
- DB schema 변경 (신규 테이블 추가 + 기존 테이블 컬럼 추가)
- 기존 베타 웹 클라이언트는 정식 출시 후 게스트 fallback 외엔 deprecate, 강제 업데이트 안내 (앱 스토어 링크)

---

## §19. 변경 로그

| 일자 | 변경 |
|---|---|
| 2026-05-12 | v1.0 초안 작성 — 13개 핵심 결정 + 8개 잔여 결정 모두 반영 |
| 2026-05-13 | BM 수수료 구조 조정: 3,000~4,000원 → **1,500원 고정 (7.5%)**, 식당 정산 18,500원 (92.5%). 스케일 우선 전략 + 차기 버전 수익 다층화 시나리오 강화 (§2.4) |
| 2026-05-14 | 지도 SDK 변경: Mapbox(`@rnmapbox/maps`) → **네이버 지도 SDK (`@mj-studio/react-native-naver-map`)**. Mapbox의 한국 도로·골목 데이터 한계(OSM 기반)로 적합성 ↓ 발견. 카카오 Local API는 매장 검색에 그대로 유지 |
| 2026-05-14 | 문서 viewpoint 재구성 — 단독 PRD로 재작성. 모든 결정·세부 명세는 보존, 비교성 표현 (예: "유지", "신규" 표시) 제거. V1 의존성 없이 자기 충족적 명세서로 |
| 2026-05-21 | `/office-hours` 후 β-compact phased rollout 채택 (APPROVED). 5개 premise(P1~P5) 동시 베팅 회피. Phase 1+2 / Phase 3 분리. 의사결정 기록: archive/OFFICE_HOURS_DESIGN_2026-05-21.md |
| 2026-05-21 | `/plan-eng-review` 통과 (CLEARED). 3 critical decisions resolved: D1 (Kakao verify-track + lazy backup), D2 (다크 디테일만 reduce, OCR + 지도-일정 mode keep), D3 (partnerships only schema). 의사결정 기록: archive/ENG_REVIEW_2026-05-21.md |
| 2026-05-21 | DESIGN.md v1.0 확정 (Pretendard Variable, 5-stage heat ramp, 토스 풍 절제, 다크모드 독립 디자인). PRD §10 (15줄)를 확장하는 단일 시각 진실 공급원 |
| 2026-05-22 | β-compact 결정을 PRD에 반영: §0/§1 헤더에 Phase 1+2 활성 + 🔒 Phase 3 라벨, §2.2 BM 섹션 + §8 결제·정산 시스템 전체 🔒 Phase 3 라벨, §5.7 예약 흐름을 Phase 1+2(click-through만) / Phase 3(실제 결제)로 분리, §13 출시 전략을 β-compact phased rollout으로 교체, §16 Open Questions를 OPEN_QUESTIONS.md로 통합. AI 코딩 하네스 구조로 재구성 (CLAUDE.md, .claude/rules·skills·hooks, docs/DECISIONS·OPEN_QUESTIONS·ARCHITECTURE·TASK_BACKLOG·SESSION_LOG·PROGRESS) |

---

**END OF DOCUMENT**

→ 이 문서는 **현재 진실**. β-compact 이전의 풀 v1.0 비전(reservations/payments/payouts 포함)은 [archive/V2_PRD_2026-05-14.md](archive/V2_PRD_2026-05-14.md) 참조.
