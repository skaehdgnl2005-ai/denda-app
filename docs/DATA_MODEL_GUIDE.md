# 데이터 모델 가이드 — 된다 (DenDa) Supabase 테이블 쉽게 읽기

> **비전공자용 설명서.** 21개 테이블이 각각 앱의 어떤 기능을 담당하는지를 기능 흐름 순서로 설명한다.
> 컬럼 정의·타입·인덱스 같은 **기술 SSoT는 [ARCHITECTURE.md §2](ARCHITECTURE.md#2-데이터-모델-phase-12-schema)**,
> 실제 정의는 [supabase/migrations/](../supabase/migrations/)의 SQL 파일들.
> 이 문서는 "이 테이블이 왜 있는가"를 설명한다. 스키마를 바꿀 때는 ARCHITECTURE.md §2도 함께 갱신할 것.

---

## 0. 먼저 큰 그림

테이블 = **엑셀 시트 한 장**. 시트마다 열(컬럼)이 정해져 있고, 한 줄(row)이 데이터 하나다.
시트끼리는 "이 줄은 저 시트의 저 줄과 연결됨"이라는 선(외래키, FK)으로 이어져 있다.

된다 앱의 핵심 흐름:

```
카카오 로그인 → 친구 맺기 → 모임 만들기 → 친구 초대 → 시간 투표(히트맵)
   → 호스트가 시간 확정 → 지도에서 장소 확정 → "예약하기" 클릭
                                    ↘ 캘린더에 자동 등록 + 푸시 알림
```

21개 테이블은 이 흐름의 각 단계를 저장하는 시트들이다.

**한 문장 요약**: `users`(사람)와 `groups`(모임)가 두 기둥, `votes`가 앱의 심장,
`places`+`partnerships`+`click_events`가 돈이 나올 자리, 나머지는 그 셋을 안전하고 편하게 돌리는 보조 장치.

---

## 1. 사람과 관계 (5개)

| 테이블 | 한 줄이 뜻하는 것 | 관련 화면 |
|---|---|---|
| `users` | 가입자 1명. 카카오 ID, 닉네임, 프로필 사진 | 프로필, 친구 검색 |
| `friend_requests` | 친구 요청 1건 (대기/수락/거절/취소) | `friends` 탭 |
| `friendships` | 성립된 친구 관계 | `friends` 탭 |
| `blocks` | 차단 1건 ("A가 B를 차단함") | 프로필 > 차단 |
| `reports` | 신고 1건 (사유 + 상세) | 프로필 > 신고 |

### 알아둘 점 3가지

**① `users`는 로그인 정보가 아니다.**
비밀번호·세션은 Supabase가 관리하는 `auth.users`라는 별도 영역에 있고,
`public.users`는 거기에 1:1로 붙는 "프로필 카드"다.
카카오 로그인이 성공하면 트리거(자동 실행 규칙)가 `users` 줄과 `notification_settings` 줄을
자동으로 만들어 준다 → [0001_initial.sql:429](../supabase/migrations/0001_initial.sql#L429) `handle_new_auth_user()`

**② 친구 관계는 두 줄로 저장된다.**
A→B, B→A 두 줄. "A의 친구 목록"을 뽑을 때 한 방향만 보면 되니까 조회가 빠르다.

**③ `blocks`가 앱 전체의 안전장치다.**
`is_blocked(나, 상대)` 함수가 하나 있고 ([0001_initial.sql:94](../supabase/migrations/0001_initial.sql#L94)),
친구 검색·추천·모임 멤버·초대 등 **모든 조회**에 이 함수가 끼어 있다.
서로 차단한 사이면 데이터베이스 레벨에서 아예 안 보인다 — 앱 코드가 실수해도 뚫리지 않는다.
→ 결정 [D16](DECISIONS.md#d16--차단신고-일관성-helper-function--rls)

---

## 2. 모임 (5개)

| 테이블 | 한 줄이 뜻하는 것 | 관련 화면 |
|---|---|---|
| `groups` | 모임 1개. 이름, 후보 날짜들, 확정 시간, 확정 장소, 4자리 초대코드 | `group/[id]` |
| `group_members` | "이 모임에 이 사람이 들어와 있다" | 모임 멤버 목록 |
| `group_invitations` | 초대 1건 (대기/수락/거절/만료) | 초대 시트 |
| `group_guests` | **가입 안 한 사람**이 웹 링크로 들어와 투표한 기록 | 웹 게스트 페이지 |
| `comments` | 모임 안 댓글 | `group/[id]` 하단 |

### `groups` — 이 앱에서 제일 바쁜 테이블

모임 하나의 일생이 이 한 줄에 전부 기록된다.

| 컬럼 | 뜻 |
|---|---|
| `dates` | 호스트가 고른 후보 날짜들 (여러 개) |
| `confirmed_at` / `confirmed_start_at` / `confirmed_end_at` | 시간 확정 도장. **비어 있으면 "아직 투표 중"**, 채워져 있으면 "확정됨" — 앱 화면이 갈리는 기준 |
| `confirmed_place_id` | 확정된 식당 (→ `places`) |
| `invite_code` | 4자리 숫자. 카톡 링크의 딥링크가 실패했을 때 손으로 입력하는 백업 통로 |
| `f4_sent_at` / `f5_sent_at` | 알림을 이미 보냈다는 표시. 서버가 재시도해도 **알림이 두 번 가지 않게** 막는 장치 |
| `calendar_pushed_at` / `calendar_retry_count` / `partial_fail_list` | 캘린더 자동 등록 진행 상황 (§7) |

DB가 강제하는 규칙: 후보 날짜가 최소 1개, 확정 3종(`confirmed_at`/`start`/`end`)은
**전부 비었거나 전부 채워져 있거나** 둘 중 하나 — 어중간한 상태가 저장될 수 없다.

관련 결정: [D17](DECISIONS.md#d17--push-f4-idempotency-groupsf4_sent_at-column) (알림 중복 방지),
[D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피) (invite_code),
[0016_deeplink_schema.sql](../supabase/migrations/0016_deeplink_schema.sql)

### `group_guests` — 성장 엔진

카톡으로 받은 링크를 **앱 없이 웹에서** 열어 투표할 수 있다.
나중에 그 사람이 가입하면 `converted_user_id`에 "이 게스트가 이 회원이 됐다"가 기록된다.
게스트 → 회원 전환율을 여기서 센다.

---

## 3. 시간 투표 — 앱의 심장 (1개)

`votes` — **한 줄 = "누가 / 며칠 / 몇 시부터 몇 시까지 가능하다"**

```
group_id: 이 모임에서
user_id 또는 guest_token: 이 사람이   ← 둘 중 정확히 하나만 (회원 or 게스트)
day: 2026-08-15에
start_minute: 540 (= 09:00)
end_minute:   690 (= 11:30)
```

시간을 `"09:00"` 같은 글자가 아니라 **자정부터 몇 분 지났는지 숫자**로 저장한다.
540 = 9시간 × 60분. 계산·비교가 압도적으로 빨라서 히트맵을 60fps로 그릴 수 있다.

**DB가 강제하는 규칙:**
- **15분 단위만 허용** (`start_minute % 15 = 0`) — 7분·13분 같은 값은 저장 자체가 거부됨 → [D14](DECISIONS.md#d14--시간-슬롯-단위-강제-15분--db-check-constraint)
- **09:00 ~ 24:00 범위만** (540 ~ 1440)
- **회원이거나 게스트이거나, 둘 중 하나만** — 애매한 줄이 생길 수 없음

**히트맵은 서버에서 합산한다.**
사람이 많이 겹치는 시간대가 진하게 보이는 그 화면은, 앱이 투표 원본을 다 받아서 계산하지 않는다.
그러면 ① 남의 투표 내역이 그대로 노출되고 ② 7명이 동시에 투표할 때 화면이 버벅인다.
서버(Edge Function)가 합산한 숫자만 앱으로 방송한다.
→ [D11](DECISIONS.md#d11--realtime-히트맵--edge-function-합산-후-broadcast-옵션-b),
[ARCHITECTURE.md §4](ARCHITECTURE.md#4-realtime-히트맵-60fps-critical--d11)

---

## 4. 개인 일정 (1개)

`schedules` — 사용자 개인 일정. `source` 컬럼이 출처를 구분한다.

| `source` | 뜻 |
|---|---|
| `manual` | 앱에서 직접 입력 |
| `google` / `apple_ios` | 기기 캘린더에서 가져옴 |
| `everytime` | **에브리타임 시간표 스크린샷을 AI가 읽어서** 자동 등록 |

`everytime`은 `recurrence_rule`에 "매주 월 09:00" 같은 반복 규칙,
`expires_at`에 학기 종료일이 들어간다 (학기 끝나면 자동 만료).

이게 있어야 시간 투표 화면에서 "너 이때 수업 있는데?"를 미리 회색으로 깔아줄 수 있다.
→ [D15](DECISIONS.md#d15--schedulessource-enum--phase-12은-provider-구분-포기)

---

## 5. 장소와 지도 (3개)

| 테이블 | 한 줄이 뜻하는 것 | 관련 화면 |
|---|---|---|
| `places` | 식당·카페 1곳. 이름, 주소, 위도·경도 | 지도 탭, 마커 바텀시트 |
| `partnerships` | 제휴 계약 1건 (계약일, 상태, 담당자 카톡 ID) | (운영팀 수동 등록) |
| `group_origins` | **모임 멤버 각자의 출발지** (중간지점 계산용) | 지도 탭 > 중간지점 |

**`places.partnership_id`가 비어 있으면 일반 식당, 채워져 있으면 제휴 식당.**
지도에서 보라색 마커로 강조되는 곳이 이거다. 수익 모델의 출발점이라
지금 단계에선 읽기 전용(운영팀이 수동 등록)이다. → [D3](DECISIONS.md#d3--phase-3-schema-설계-시점-옵션-b--partnerships-only)

좌표(`lat`/`lng`)는 카카오·네이버 등 어디서 왔든 **WGS84 하나로 정규화**해서 저장한다.
→ [D18](DECISIONS.md#d18--좌표계-정규화-layer)

**`group_origins`** ([0023](../supabase/migrations/0023_group_origins.sql)) — 멤버가 각자
"나 강남역에서 출발"을 등록하면 중간지점을 잡아준다.
**1인 1출발지**이고, 모임을 나가면(자진 탈퇴·호스트 강퇴) 트리거가 출발지를 자동으로 지운다 —
나간 사람의 위치가 남아 있으면 안 되니까.
→ [D41](DECISIONS.md#d41--모임-출발지-서버-저장-group_origins-q-b23-부분-supersede)

---

## 6. 알림 (2개)

| 테이블 | 한 줄이 뜻하는 것 |
|---|---|
| `push_tokens` | 이 사람의 이 기기로 알림을 보낼 수 있는 주소 (기기마다 1줄) |
| `notification_settings` | 알림 종류별 켜기/끄기 스위치 |

알림은 5종이고, `notification_settings`의 `f1_enabled` ~ `f5_enabled` 스위치와 1:1로 대응한다.

| | 언제 | 누구에게 | 열리는 화면 |
|---|---|---|---|
| F1 | 친구 요청 받음 | 받은 사람 | `friends` 탭 |
| F2 | 친구 요청 수락됨 | 보낸 사람 | `friends` 탭 |
| F3 | 모임 초대 받음 | 초대받은 사람 | `group/[id]` |
| F4 | **전원 투표 완료** | 호스트만 | `group/[id]` |
| F5 | **시간·장소 확정** | 회원 멤버 전원 (게스트 제외) | `group/[id]` |

댓글(`comments`)에는 **의도적으로 알림이 없다** — 시끄러워지니까.
F6·F7은 Phase 3 (🔒 현재 금지).

---

## 7. 캘린더 자동 등록 (2개)

모임이 확정되면 멤버들 캘린더에 자동으로 들어간다.
그런데 구글과 애플의 방식이 완전히 달라서 테이블이 나뉜다.

| 테이블 | 방식 |
|---|---|
| `user_oauth_tokens` | **구글용.** 사용자가 계정 연동을 허락하면 여기에 열쇠(토큰)를 맡겨두고, 서버가 그 열쇠로 대신 일정을 넣는다. **사용자가 앱을 안 켜도 된다.** |
| `calendar_push_apple_pending` | **애플용.** 아이폰 캘린더는 서버가 직접 못 건드린다. "이 사람 캘린더에 이거 넣어야 함"을 대기표로 쌓아두고, **사용자가 다음에 앱을 열 때** 앱이 처리한 뒤 `completed_at`에 완료 도장을 찍는다. |

`user_oauth_tokens`의 토큰은 남의 구글 캘린더를 열 수 있는 열쇠라서,
본인과 서버(service_role)만 접근 가능하도록 잠겨 있다.

**"대기"와 "실패"는 다르다.**
`calendar_push_apple_pending`에 줄이 남아 있는 건 정상적인 대기 상태(앱 열면 처리됨)이고,
`groups.partial_fail_list`에 이름이 올라간 건 3번 재시도 후에도 실패한 진짜 문제다.

관련: [D20](DECISIONS.md#d20--calendar-push-fan-out--background-queue) (백그라운드 큐),
[D34](DECISIONS.md#d34--apple-calendar-sync--클라-polling-패턴-q-b22-close) (애플 polling),
[D35](DECISIONS.md#d35--google-calendar-oauth-token-서버-측-저장--user_oauth_tokens-table) (구글 토큰 서버 저장)

---

## 8. 측정 · 성장 추적 (2개)

| 테이블 | 한 줄이 뜻하는 것 |
|---|---|
| `click_events` | 지도 마커 바텀시트에서 **"예약하기"를 누른 기록** |
| `branch_attributions` | 카톡 링크 클릭 → 앱 설치 → 가입을 이어 붙이는 추적 기록 |

**`click_events`가 이 프로젝트의 운명을 정한다.**
다음 단계(결제 기능, Phase 3)로 갈지 말지를 판단하는 **핵심 지표(Gate #2)**라서 테이블이 따로 있다.
줄의 ID(`event_id`)를 앱이 미리 만들어서 보내기 때문에,
사용자가 더블탭하거나 네트워크가 재시도해도 **정확히 1건만** 기록된다.
`partnership_id`는 클릭 당시의 제휴 여부를 박제해 둔다 — 나중에 제휴가 끊겨도 과거 데이터가 안 흔들린다.
→ [0017_click_events.sql](../supabase/migrations/0017_click_events.sql)

**`branch_attributions`** — 카톡 링크를 누른 사람이 앱을 깔고 가입했을 때
"아까 그 링크로 들어온 사람이구나"를 이어 붙인다. IP·브라우저 정보의 **해시값**(원본 아님)으로 매칭한다.
이름의 `branch_` 접두사는 과거 Branch.io를 쓰려다 자체 구현으로 바꾼 흔적이고, 이름만 남아 있다.
→ [D28](DECISIONS.md#d28--자체-deferred-deep-link-구축-attribution-saas-회피-도메인-구매-회피)

---

## 9. 전체 지도

```
users ─┬─ friendships / friend_requests / blocks / reports
       ├─ schedules                     (개인 일정)
       ├─ push_tokens / notification_settings
       ├─ user_oauth_tokens             (구글 캘린더 열쇠)
       │
       └─ groups (모임) ──┬─ group_members   (회원 참여자)
                         ├─ group_guests    (비회원 참여자) ─→ branch_attributions
                         ├─ group_invitations
                         ├─ votes ← users 또는 group_guests
                         ├─ comments
                         ├─ group_origins   (출발지)
                         ├─ calendar_push_apple_pending
                         └─ confirmed_place_id → places → partnerships
                                                   ↑
                                              click_events (예약하기 클릭)
```

---

## 10. 아직 없는 테이블 (Phase 3)

결제 관련 3개는 **의도적으로 안 만들었다.** Gate를 통과해야 만든다.

```
+ reservations (예약)
+ payments     (결제)
+ payouts      (정산)
+ groups.reservation_id 컬럼 1개 추가
```

→ 3 테이블 추가 + 컬럼 1개 = 작은 마이그레이션이라 미리 만들 이유가 없다.
[D3](DECISIONS.md#d3--phase-3-schema-설계-시점-옵션-b--partnerships-only)

---

## 11. 실제 파일 찾아보기

| 궁금한 것 | 볼 곳 |
|---|---|
| 테이블 21개 원본 정의 | [0001_initial.sql](../supabase/migrations/0001_initial.sql) (17개) + 0009·0012·0013·0016·0017·0021·0023 |
| 누가 뭘 볼 수 있는지 (보안 규칙) | [0002_rls.sql](../supabase/migrations/0002_rls.sql), [0004_web_guest_rls.sql](../supabase/migrations/0004_web_guest_rls.sql), [0022_fix_rls_recursion.sql](../supabase/migrations/0022_fix_rls_recursion.sql) |
| 컬럼 타입·인덱스 요약표 | [ARCHITECTURE.md §2](ARCHITECTURE.md#2-데이터-모델-phase-12-schema) |
| "왜 이렇게 설계했나" | [DECISIONS.md](DECISIONS.md) |
| 서버 로직 (알림·집계·캘린더) | [supabase/functions/](../supabase/functions/) |

---

**Last updated**: 2026-07-29 (최초 작성 — 마이그레이션 0001~0023 기준, 테이블 21개)
