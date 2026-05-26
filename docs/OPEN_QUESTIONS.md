# Open Questions

> 미해결 질문 통합 보드. 답이 나오면 [DECISIONS.md](DECISIONS.md)에 옮기고 여기 항목은 `Closed by D{N}`으로 표기.
> 출처: V2_PRD §16, OFFICE_HOURS §10·§14, DESIGN §14, ENG_REVIEW §11

---

## A. Pre-build 필수 (Sprint 0 이전 또는 W1 deadline)

### Q-A1 — Kakao 비즈앱 우회 OAuth 정책 답변 ✅ Closed by D29 (2026-05-22)
- **출처**: V2_PRD §16-1, OFFICE_HOURS §13, ENG_REVIEW §1.2
- **질문**: synthetic email + HMAC OAuth가 Kakao 정책 위반 아닌지 서면 확인
- **소유자**: Founder
- **마감**: 2026-05-28 (D1 W1 deadline) — 무의미해짐
- **해결**: D29 채택으로 비즈앱 우회 OAuth 자체를 사용하지 않음. 표준 OIDC + Supabase `signInWithIdToken` 사용. 카카오 정책 답변 의존 해소. S01 BLOCKED 해소
- **상태**: Closed (2026-05-22)

### Q-A2 — Kakao Local API 약관 (외부 지도 SDK 위 표시)
- **출처**: V2_PRD §16-6, OFFICE_HOURS §13, ENG_REVIEW §1.2
- **질문**: Naver 지도 위에 카카오 Local API 매장 데이터 표시 허용 명시적 확인
- **소유자**: Founder
- **마감**: 2026-05-28 (D1 W1 deadline)
- **해결 시**: D1 확정 / 미수신 시 → Naver Search API eager fallback (S16) + 데이터 quality 열화 수용
- **상태**: 진행 중

### Q-A3 — 1주 cold read prototype 병렬 실행 여부
- **출처**: OFFICE_HOURS §10-16, §14-1
- **질문**: 모바일 빌드 4주 burn 전 Solapi 알림톡 + Next.js + Supabase로 시간 그리드 카톡 link prototype 1주 시도? 정의진 + N=4-9 시나리오 재현으로 coordination-only standalone 가치 falsify
- **소유자**: Founder
- **마감**: 모바일 build 시작 결정 시점
- **해결 시**: 결정 (실행 / 스킵 / 부분 실행). 결과는 Phase 1+2 scope에 feedback
- **상태**: 미결정 (founder 결정 대기)

### Q-A4 — Baseline 측정 design (W0-W2 데이터 수집 schema)
- **출처**: OFFICE_HOURS §10-14, §14-2
- **질문**: Phase 1+2 launch 후 어떤 metric, 어떤 segmentation label(P1 학생/P2 직장인), 어떤 collection point. Gate #1/#2 calibrate 위한 W0-W2 baseline
- **소유자**: Founder + Data
- **마감**: W0 (launch 시점)
- **해결 시**: 측정 instrument spec → S08 (Click-through 측정)
- **상태**: 미정의

### Q-A5 — Pre-mortem communication script (Gate #2 < 10% 시)
- **출처**: OFFICE_HOURS §10-13, §14-3
- **질문**: Gate #2 < 10% 시나리오 시 식당 20곳에 보낼 communication 한 줄. 3-path(coordination-only / timeline 재조정 / P2 retry) 각각 message 초안
- **소유자**: Founder + Operations
- **마감**: W2 (Gate 측정 시작 전)
- **해결 시**: 식당 retention 패키지 (OFFICE_HOURS §9.3) 완성
- **상태**: 미작성

### Q-A6 — 자체 deferred deep link 정확도 PoC (D28 후 재정의)
- **출처**: V2_PRD §16-8, ENG_REVIEW §1.6, §11
- **질문**: 한국 NAT 환경에서 자체 구축 fingerprint 매칭(IP hash + UA hash + install timing)의 정확도. Universal Links 매칭률은 별도. 4자리 코드 fallback 의무 활성 결정.
- **소유자**: Backend
- **마감**: Phase 1+2 W1 (build와 병렬 PoC)
- **해결 시**: S15 자체 구축 acceptance 확정. fallback UX flow 결정 (강제 코드 입력 vs optional)
- **상태**: SaaS 선택 = 자체 구축 ([D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)). 4가지 risk 명시 수용. 정확도 50% 이하 가능 → 4자리 코드 fallback 의무 활성 가능성 ↑
- **노트**: 이전 Branch.io 대상 → Singular 대상([D27](DECISIONS.md#d27--attribution-saas--singular-베타-한정-phase-3-재평가) invalid) → 자체 구축으로 두 번 재정의

### Q-A8 — 차단된 호스트의 모임이 차단자(멤버)에게 보여야 하는가 ✅ Closed by D31 (2026-05-26)
- **출처**: S07-d16-audit (2026-05-26) — D16 propagation audit 중 발견
- **질문**: A가 B를 차단했을 때, B가 호스트인 모임에 A가 이미 멤버로 참여 중이라면 A의 "내 모임" list에 그 모임을 노출할 것인가?
- **결정**: 부분 노출 채택 ([D31](DECISIONS.md#d31--차단-호스트-모임--부분-노출-groups-select-불변--클라이언트-호스트-mask)). `groups` SELECT 변경 없음 — 호스트 닉네임·프로필은 기존 `users SELECT`의 is_blocked가 자연 mask. 추가 UI 처리 불요(자연 mask가 충분). 멤버십 연속성 > 차단 강도.
- **상태**: Closed (2026-05-26)

### Q-A7 — Kakao RN 패키지의 native nonce 미지원 → 베타 수용 (option c)
- **출처**: S01 구현 중 발견 (2026-05-23)
- **결정**: 베타 launch까지는 option (c) 수용. `setup.ts`의 supabaseAuth 어댑터에서 Supabase에 nonce 전달 자체를 skip (Supabase 측 "nonce_hash mismatch" 거부 회피). replay 공격 risk는 카카오 id_token 짧은 만료(~10분) + Supabase JWT 자체 검증으로 완화. 결정일: 2026-05-24 (S01 스모크 테스트 통과)
- **재검토**: W3 (TestFlight Internal 시작 시점) — 다음 옵션 선택:
  - (a) `@react-native-kakao/user` 패키지에 native bridge nonce 인자 추가 PR
  - (b) `@react-native-seoul/kakao-login` 교체 (native nonce 지원 PoC)
- **상태**: 베타 수용 (재검토 W3)

---

## B. Phase 1+2 진행 중 closure (Sprint 0~4 중)

### Q-B1 — 모임 생성 트랜잭션 통합
- **출처**: V2_PRD §16-1
- **질문**: Edge Function 단일 트랜잭션 vs 클라이언트 chain
- **소유자**: Backend
- **마감**: S03 (Step 4 모임 확정 + F5 push) 시작 전
- **상태**: 미결정

### Q-B2 — API 인증 방식 통일
- **출처**: V2_PRD §16-2
- **질문**: Supabase Auth JWT가 Google·Apple Calendar 호출 시 매핑 가능 (호출 흐름)
- **소유자**: Backend
- **마감**: S05 (Step 5 Calendar sync) 시작 전
- **상태**: 미결정

### Q-B3 — 푸시 알림 트리거 위치
- **출처**: V2_PRD §16-3
- **질문**: Supabase DB trigger vs Edge Function vs Vercel Cron. F4 idempotency는 D17 적용, F1-F3·F5는 미정
- **소유자**: Backend
- **마감**: S12 (Step 9 Push F1-F3) 시작 전
- **상태**: 미결정 (D17으로 F4만 부분 해결)

### Q-B4 — 이미지 업로드 경로
- **출처**: V2_PRD §16-4
- **질문**: 식당 photos 등은 Supabase Storage vs CloudFront
- **소유자**: Backend
- **마감**: S10 (Step 6 지도) 식당 사진 표시 시점
- **상태**: 미결정. **권고**: Supabase Storage (단일 vendor 유지)

### Q-B5 — Edge Function 단일 dispatcher ✅ Closed by D33 (2026-05-26)
- **출처**: ENG_REVIEW §9.4, §11
- **질문**: Calendar push(Step 5) + Push 알림(Step 9) 둘 다 모임 확정 trigger를 듣는데 단일 dispatcher EventBus pattern 적용 여부
- **결정**: 단일 dispatcher 채택 ([D33](DECISIONS.md#d33--모임-확정-fan-out--단일-dispatcher-q-b5-close)). `group_confirm` Edge Function 1곳이 publisher, `_lib/dispatcher.ts`의 `register`/`dispatch`로 in-process fan-out. F5는 dispatcher 내부 직접 호출, Calendar는 D20 background queue로 분리. DB trigger 분산 거부.
- **상태**: Closed (2026-05-26, S04 시작 시점)

### Q-B6 — Realtime disconnect UI
- **출처**: ENG_REVIEW §8 #3, §11
- **질문**: Supabase Realtime disconnect 시 stale heatmap silent → 명시 UI 디자인 (그리드 헤더 info-bg 칩 "실시간 갱신 일시 중단 — 30s 후 폴링", DESIGN §11.4)
- **소유자**: Design + Frontend
- **마감**: S07 (Step 3 시간 그리드 + 투표) 마무리 전
- **상태**: 디자인 명시는 있음, 구현 미정

### Q-B7 — 게스트 토큰 충돌 (같은 브라우저 다른 모임)
- **출처**: ENG_REVIEW §8 #9
- **질문**: localStorage key collision 방지 — 모임별 별도 토큰 schema
- **소유자**: Frontend (Web)
- **마감**: S14 (Step 10 Web guest) 진행 중
- **상태**: 미설계

### Q-B8 — 카카오 Local API Server proxy 도입 여부
- **출처**: ENG_REVIEW §4.2, §11
- **질문**: Cost·QPS control 위해 server-side proxy. Phase 1+2 미도입 시 quota burst risk
- **소유자**: Backend
- **마감**: Gate #1 측정 시작 전 (W2)
- **상태**: 미결정. D26은 client-side만 결정

### Q-B9 — FAB 글리프 최종 디자인
- **출처**: DESIGN §14 D-FAB, §16.1.5, V2_PRD §16-5
- **질문**: 가운데 탭 "모임 만들기" FAB의 커스텀 SVG (캘린더+plus 합성, 16pt 화이트)
- **소유자**: Design
- **마감**: Sprint 0
- **상태**: 미디자인

### Q-B10 — 된다 브랜드 마크 (라이트/다크)
- **출처**: DESIGN §14 D-LOGO, §9.2.1
- **질문**: 된다 로고 SVG 라이트·다크 두 버전
- **소유자**: Design
- **마감**: Sprint 0
- **상태**: 미디자인

### Q-B11 — 빈 상태 일러스트 5종
- **출처**: DESIGN §14 D-EMPTY-ART, §11.2
- **질문**: 빈 상태 line art 또는 따뜻한 톤 일러스트 (단색 + brand-200). 홈/친구/내 모임/그리드/지도 viewport 비어있음
- **소유자**: Design
- **마감**: Sprint 1
- **상태**: 미작업

### Q-B12 — F1~F7 푸시 알림 마이크로카피
- **출처**: DESIGN §14 D-PUSH-COPY, V2_PRD §9.1
- **질문**: F1(친구 요청), F2(친구 수락), F3(모임 초대), F4(전원 투표 완료), F5(시간 확정), F6/F7(Phase 3) 카피
- **소유자**: Founder + Copy
- **마감**: Sprint 1
- **상태**: 미작성

### Q-B13 — 제휴 마커 PNG export
- **출처**: DESIGN §14 D-PARTNER-MARKER, §9.2.2, §10.2
- **질문**: 제휴 마커 1.5x/2x/3x PNG (Naver SDK SVG 불가 — D8 명시)
- **소유자**: Design
- **마감**: Sprint 0
- **상태**: 미export

### Q-B14 — 3-슬라이드 온보딩 모션
- **출처**: DESIGN §14 D-ONBOARD-MOTION
- **질문**: 실제 앱 화면 모션 캡처 (일러스트 X)
- **소유자**: Design + Engineering
- **마감**: Sprint 2
- **상태**: 미설계

### Q-B15 — 30명 Prior MVP user 전환 방식
- **출처**: OFFICE_HOURS §10-12
- **질문**: 카톡 메시지 자동 발송 vs 수동. 첫 push 받을 사람 가치 활용 방식
- **소유자**: Founder + Operations
- **마감**: W3 (TestFlight 시점)
- **상태**: 미결정

### Q-B16 — 베타 지역 최종 선정
- **출처**: V2_PRD §16-9
- **질문**: 강남/홍대/건대 중 영업 도달 가능 1~2개 (현재 안암 베타로 default)
- **소유자**: Founder
- **마감**: launch 직전
- **상태**: 안암 default (변경 가능)

### Q-B17 — 식당 영업 자료 패키지
- **출처**: V2_PRD §16-10
- **질문**: 소개서·계약서·정산 시뮬레이션 도구. Phase 3 시점 전 준비
- **소유자**: Founder
- **마감**: Phase 3 진입 시점
- **상태**: 미작성

### Q-B18 — 운영팀 카톡 채널 SOP
- **출처**: V2_PRD §16-11
- **질문**: 노쇼 신고·환불 분쟁·식당 응대 SOP
- **소유자**: Founder + Operations
- **마감**: W3 (TestFlight)
- **상태**: 미작성 (PRD §17.2에 큰 틀만)

### Q-B19 — Comments 인디케이터 (last_seen_comment_id)
- **출처**: ENG_REVIEW §2.6, §11
- **질문**: `group_member_states.last_seen_comment_id` column + 모임 카드 "새 코멘트 N" 배지 (앱 내만, 푸시 X)
- **소유자**: Frontend
- **마감**: S07 마무리 시
- **상태**: 미결정 (정책은 OK, 구현 미정)

### Q-B20 — Apple Developer + Google Play Console 가입 timing
- **출처**: ENG_REVIEW §10
- **질문**: 가입 + 인증서 발급 + TestFlight/Internal Testing 셋업. Apple 심사 1주 + 거절 가능성 buffer
- **소유자**: Founder
- **마감**: W-2 (Sprint 0 전)
- **상태**: 미시작

### Q-B22 — Apple Calendar sync mechanism (worker → client trigger 패턴) ✅ Closed by D34 (2026-05-26)
- **출처**: S06-google-oauth ship 후 노출 (2026-05-26). Apple Calendar 외부 push API 부재로 worker가 직접 push 불가
- **질문**: S06 Apple sync는 client-side `expo-calendar.createEventAsync`만 가능. 그러나 D20 background queue·D19 partial fail report는 worker(서버) 기준 설계 — Apple 사용자의 calendar push를 어떻게 worker가 trigger·track하느냐
- **소유자**: Backend + Mobile
- **해결**: (b) 클라 polling 채택. worker가 `calendar_push_apple_pending` 신규 table에 row INSERT → 앱 foreground 진입 시 SELECT → `AppleCalendarProvider.insertEvent` → row UPDATE `completed_at`. partial_fail_list와 의미 분리(별도 table — pending ≠ failure). 24h 미완료 stale row는 호스트 알림 trigger 후보. (a) Silent push는 iOS 3/hour throttle + Android 호환성 부족 + ack endpoint 복잡으로 거부. (c) Realtime broadcast는 백그라운드 socket 끊김 + missed message 복구 안 됨으로 거부. (b-mixed) partial_fail_list channel='apple_pending' 재사용은 의미 혼란으로 거부
- **상태**: Closed (2026-05-26) — [D34](DECISIONS.md#d34--apple-calendar-sync--클라-polling-패턴-q-b22-close). 후속 sub-task: S06-worker-apple-trigger (migration 0013 + worker apple_ios 분기 + 클라 hook `useApplePendingSync`)

---

### Q-B21 — D11 heatmap broadcast payload에 day 차원 누락 ✅ Closed by D11 update (2026-05-26)
- **출처**: S05b 구현 중 발견 (2026-05-26)
- **질문**: D11 본문 spec은 `{slots: [{start_minute, count}], updated_at}`만 명시. 그러나 `votes` 테이블에 `day DATE NOT NULL` 컬럼이 있고 시간 그리드는 60slot × N day = N×60 cells이 필수 (S05 acceptance). 7일 고정 가정 불가 — `groups.dates DATE[]`는 가변 길이.
- **소유자**: Backend
- **마감**: S05b PR 머지 전 또는 S05a PR 머지 전 (둘 중 빠른 쪽)
- **해결**: (a) `day_index` 채택 — `groups.dates`의 0-based offset. S05a Edge Function `votes_aggregate`에 `mapDayToIndex(rawRows, dates)` 추가 + handler에서 groups.dates SELECT 후 매핑. groups.dates에 없는 votes.day는 graceful skip (호스트가 dates 줄였을 때 안전). D11 본문 + 예제 갱신 완료 (D11 표 Payload spec 행 추가). S05b 클라이언트 헬퍼(`applyHeatmapPayload`)가 이미 (a) 가정으로 구현되어 있어 spec align 완료
- **상태**: Closed (2026-05-26, S05a + Q-B21 patch 한 PR로 머지)

---

## C. Phase 3 deferred (Gate #2 통과 시에만)

### Q-C1 — 토스페이먼츠 분할정산 시뮬레이션
- **출처**: V2_PRD §16-7
- **질문**: 실제 호출 흐름 PoC
- **소유자**: Backend (Phase 3 시점)
- **상태**: 보류

### Q-C2 — Phase 3 도메인 schema 설계
- **출처**: D3 + ENG_REVIEW §1.3
- **질문**: `reservations`, `payments`, `payouts` 테이블 + 수수료율·정산 모델 detail
- **소유자**: Backend + Founder (Phase 3 진입 시)
- **상태**: 보류

### Q-C3 — Apple ID 로그인 정식 추가
- **출처**: ENG_REVIEW §11, §7.2
- **질문**: 정식 출시 시 Apple ID 등가 제공 (App Store guideline 4.8). 베타는 카카오 only로 가능
- **소유자**: Backend (Phase 3 / 정식 출시 시)
- **상태**: 보류

### Q-C4 — 다크모드 디테일 검증
- **출처**: D2, ENG_REVIEW §0.2 A
- **질문**: 마커·차트·맵 두 톤 일치 검증
- **소유자**: Design + QA (Phase 3 시)
- **상태**: 보류

### Q-C5 — 외부 캘린더 양방향 동기화
- **출처**: V2_PRD §7.5
- **질문**: 네이버 캘린더 동기화. Apple Calendar 양방향(현재는 push only)
- **상태**: 보류

### Q-C6 — Geocoding for external calendar event location
- **출처**: V2_PRD §16, ENG_REVIEW §0.4
- **질문**: 외부 캘린더 일정의 위치 자동 geocoding. 베타는 모임 일정만 좌표
- **상태**: 보류

### Q-C7 — 호스트 위임
- **출처**: V2_PRD §5.4
- **질문**: 호스트 권한 위임 UX·schema
- **상태**: 보류

### Q-C8 — 자동 노쇼 판정
- **출처**: V2_PRD §17.3
- **질문**: 알림톡 + 식당 출석 체크 자동화 (베타는 manual)
- **상태**: 보류

### Q-C9 — 운영 어드민 웹
- **출처**: V2_PRD §17.3
- **질문**: 신고 처리 + 환불 처리 + 식당 관리 어드민 (베타는 manual)
- **상태**: 보류

### Q-C10 — 식당 어드민 웹 + 셀프 가입
- **출처**: V2_PRD §17.3
- **상태**: 보류

### Q-C11 — Promoted listing / 프리미엄 구독
- **출처**: V2_PRD §12 (v1.1+)
- **상태**: 보류

### Q-C12 — Memories (추억 기록)
- **출처**: V2_PRD §12.3
- **질문**: 폐기 결정 — 확정?
- **상태**: 폐기 default (재확인 필요 시 reopen)

### Q-C13 — 데스크톱 폭 지원 (웹)
- **출처**: V2_PRD §10.1, DESIGN §12.7
- **질문**: 모바일·태블릿만 → 데스크톱 확장 여부
- **상태**: 보류 (모바일만 default)

---

## D. 미분류 / 메타

### Q-D1 — 다중 가설 동시 베팅 시 진단 분리
- **출처**: OFFICE_HOURS §10-15
- **질문**: Phase 1+2 launch 후 가장 빨리 죽는 가설 격리 방법
- **소유자**: Founder + Data
- **상태**: 미설계 (Q-A4 baseline 측정과 연계)

---

## 새 질문 추가 템플릿

```markdown
### Q-{카테고리}{N} — {제목}
- **출처**: (어떤 문서 어떤 섹션)
- **질문**: (구체적으로)
- **소유자**: (책임자)
- **마감**: (날짜 또는 게이트)
- **해결 시**: (어떤 결정이 만들어지나)
- **상태**: 미결정 / 진행 중 / 답변 대기
```

답이 나오면:
1. [DECISIONS.md](DECISIONS.md)에 새 D{N} 추가
2. 이 항목을 `Closed by D{N} (YYYY-MM-DD)`로 변경
3. 일정 시간 뒤 archive 섹션으로 이동 (이 문서 하단에 추가 예정)
