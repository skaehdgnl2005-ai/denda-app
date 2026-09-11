# UI 폴리시 감사 원본 findings (2026-07-08)

> [2026-07-08-ui-polish-design.md](2026-07-08-ui-polish-design.md)의 근거 부록.
> 형식: `[심각도/카테고리/공수] 제목 @ 근거 | DESIGN 참조` + 제안.
> P0=사용자가 즉시 미완성으로 느낌/핵심 여정 · P1=완성도 저하 · P2=디테일 / S=1시간 내 · M=반나절 · L=1일+
>
> 출처: 멀티에이전트 병렬 감사 7영역(auth-onboarding, home-tab, friends-tab, map-tab, profile-tab, tab-shell, group-detail-grid — 아래 후반부) + 직접 감사 5영역(스펜드 한도로 에이전트 실패분 — 바로 아래).

---

## 직접 감사 5영역

## group-new (모임 생성 + CalendarDatePicker WIP)

총평: CalendarDatePicker WIP 자체는 상급 — 44pt 셀, a11y 라벨(날짜·요일·오늘·선택됨), 토큰 준수, 선택 카운터 힌트, 과거일 비활성. 마감 항목만 남음.

- [P1/interaction/S] 이름 입력 시 하단 고정 CTA가 키보드에 가림 — KeyboardAvoidingView 부재 @ app/group/new.tsx:116-136
  제안: KeyboardAvoidingView(behavior padding/height 플랫폼 분기)로 footer 보호. SE급 320pt에서 검증.
- [P1/interaction/S] 최대 7일 선택 후 새 날짜 탭 시 완전 무반응 — 부모 toggleDate가 조용히 무시 @ app/group/new.tsx:28-38 + CalendarDatePicker.tsx:94-130 | §17.5
  제안: atMax에서 새 날짜 탭 시 힌트 캡션 워블 모션 또는 1회 토스트("최대 7일까지 골라요"). 힌트 색 warning 전환만으로는 인지 부족.
- [P2/state-design/S] 생성 실패 Alert.alert('알림', e.message) — raw 메시지 노출 @ app/group/new.tsx:47-49 | §11.3
  제안: messages.ts 매핑 + 인라인/토스트 전환 (Wave 1 Alert 철거에 포함).
- [P2/spacing/S] footer CTA radius.lg — invite.tsx 등 다른 화면 CTA는 radius.md, 화면 간 곡률 불일치 @ app/group/new.tsx:126 | §8
  제안: 공용 Button 승격 시 radius.md로 통일.
- [P2/spacing/S] weekdayHead paddingVertical: 6 — 4pt 그리드 밖 @ CalendarDatePicker.tsx:226 | §5
  제안: space[1](4) 또는 space[2](8).
- [P2/a11y/S] 모임 이름 TextInput accessibilityLabel 부재 @ app/group/new.tsx:83-99 | §12.3
- [P2/motion/S] 월 전환 모션 없음(스냅), 셀 pressed가 opacity 0.85 단일 @ CalendarDatePicker.tsx:120,145 | §6.1
  제안: 월 전환 duration-micro 크로스페이드, pressed는 surface-3 원 배경.

## group-invite (친구 초대)

총평: 빈 상태 3요소(§11.2)와 disabled CTA(§17.5)는 모범. 결과 피드백과 로딩·에러가 미설계.

- [P1/interaction/S] 초대 결과 3종이 전부 Alert.alert 후 router.back() @ app/group/[id]/invite.tsx:81-88 | §11.3
  제안: 토스트로 교체("N명에게 초대를 보냈어요") 후 back. 부분 실패는 error variant 토스트.
- [P1/state-design/S] 로딩 = ActivityIndicator large, 에러 = raw message + 재시도 없음 @ invite.tsx:219-226 | §11.1, §11.3
  제안: FriendCard 모양 Skeleton 3장 + EmptyState error variant.
- [P2/interaction/S] 친구 행 pressed opacity 0.85 단일 @ invite.tsx:150-160 | §9.1

## place-flow (place / place-search / midpoint) — Gate #1·#2 임계경로

총평: 확정 로직(idempotent lock, actionId 통일)은 견고. 그러나 두 게이트의 UX 표면이 모두 시스템 Alert.

- [P0/interaction/M] "예약하기" 성공(Gate #2 측정 순간)이 Alert.alert('알림', ...) @ app/group/[id]/place.tsx:70 | §11.3, §6.5, §17.6
  제안: success 토스트(아이콘+친근체) 또는 시트 내 success 상태 전환(emphasized). logReservationClick 1회성 불변.
- [P0/interaction/M] 장소 확정 확인(Gate #1 신호)이 Alert.alert('~으로 정할까요?', 취소/확정) @ place-search.tsx:50-62, midpoint.tsx 동일 패턴 | §11.3, §17.6
  제안: ConfirmSheet로 교체 — 장소명 title-3 + 주소 body-sm + [다음에 정할게요/이곳으로 확정]. usePlaceConfirmAction 로직 불변.
- [P1/state-design/S] place.tsx 로딩이 "장소를 불러오는 중..." 텍스트 1줄, 에러 화면은 raw message + 뒤로가기 없는 막다른 화면 @ place.tsx:89-107 | §11.1, §11.3
  제안: Skeleton + EmptyState error variant + ScreenHeader(뒤로가기).
- [P1/component-gap/S] PlaceActionSheet CTA 높이 48pt — §10.3 스펙 56pt 미달 @ PlaceActionSheet.tsx:299-303 | §10.3
- [P2/spacing/S] PlaceActionSheet backdrop rgba(0,0,0,0.4) 하드코딩 (ConfirmSlotSheet 동일 — overlay 토큰 부재) @ PlaceActionSheet.tsx:134 | §13
- [P2/motion/S] 시트 등장이 Modal animationType="slide" 시스템 기본 — §6.5 duration-medium+easing-enter 스펙 밖 @ PlaceActionSheet.tsx:125 | §6.5
- [P2/copy/S] place-search 확인 Alert 버튼 '취소/확정' 시스템 톤 @ place-search.tsx:53-55 | §17.6

## schedule-flow (everytime OCR / 지도로 일정 보기)

- [P1/interaction/M] everytime.tsx Alert.alert 6곳 — 학기 미입력 경고·OCR 결과 없음·권한·실패가 전부 시스템 알럿 @ app/schedule/everytime.tsx:48,59,67,69,73,92 | §11.3
  제안: 학기 미입력 → 인라인 에러(§11.3 폼 패턴). OCR 결과 없음/실패 → 배너 또는 error 토스트. 권한 안내 → ConfirmSheet(설정 이동 CTA).
- [P1/state-design/M] OCR 진행(ocr_loading, 수 초 소요)이 단순 스피너 — 단계 안내 없음 @ everytime.tsx:30,52 | §11.1
  제안: "시간표를 읽고 있어요..." 카피 + Skeleton 프리뷰 형태. 진행 단계(업로드→분석) 캡션.
- [P2/spacing/S] schedule/map.tsx 헤더 inset space[3] — 전 화면 표준 space[4]와 불일치 @ app/schedule/map.tsx:94 | §5.1
- [P2/state-design/S] schedule/map.tsx 에러가 텍스트 노출 중심 — 재시도 CTA 여부 EmptyState로 표준화 @ schedule/map.tsx:66-73 | §11.3

## design-infra (계통 수치)

- [P0/component-gap/L] Alert.alert 프로덕션 48곳/15파일 (테스트 제외) — §11.3 "시스템 알럿은 마지막 수단" 전면 위반 상태
  분포: friends/requests 11, friends/index 7, everytime 6, group/[id]/index 5, friends/search 3, profile 3, invite 3, place-search 2, midpoint 2, 기타 6.
- [P1/component-gap/M] ActivityIndicator 프로덕션 10파일 — §11.1 스피너 스펙(loader-2 24pt text-brand) 미준수.
- [P1/component-gap/L] src/design = tokens·theme·typography만. 공용 프리미티브(Button/Toast/EmptyState/BottomSheet/ScreenHeader/Spinner/SearchField) 전무 — src/components에 Icon·Skeleton만 범용.
- [P1/a11y/M] isReduceMotionEnabled 사용 0건 (src 전체 grep) — §6.4·§12.5 의무 사양 미구현.
- [P2/component-gap/S] messages.ts 부재 — ko-kr 룰 i18n-ready 패턴 권고 미적용, 카피 톤 혼재의 구조 원인.

---

## 멀티에이전트 감사 7영역 (원본 그대로)

## auth-onboarding (15건)

총평: 토큰 시스템과 §17 anti-AI-feel 대응(BrandMark 히어로, 히트램프·미니맵·미니캘린더 시각 자산, disabled 회색 CTA, 친근체 카피)이 잘 반영돼 골격은 이미 상급이다. 다만 첫인상 구간의 결정적 디테일 — 다크모드 흰 스플래시, 약관 전문을 읽을 수 없는 chevron 행, 오른쪽을 가리키는 뒤로가기 아이콘, opacity 하나뿐인 pressed 피드백 — 이 "마지막 5% 미완성" 인상을 만든다.

- [P0/interaction/M] 약관 행에 chevron이 있지만 탭하면 체크 토글만 — 이용약관·마케팅 전문 화면이 아예 없음 @ app/(auth)/terms.tsx:117-151 | §12.1, §17.7
  제안: 행 탭=토글 유지, chevron을 별도 Pressable(44pt)로 분리해 약관 전문 화면 push. 전문 화면은 privacy.tsx의 Section/SubHeading/Bullet 재사용.
- [P0/interaction/S] privacy 뒤로가기 버튼이 오른쪽 화살표(ChevronRight)로 렌더됨 @ app/(auth)/privacy.tsx:44 + Icon.tsx:51-52 | §9.1
- [P0/dark-mode/S] 스플래시 게이트: 무색 ActivityIndicator + 테마 배경 미지정 → 다크모드에서 흰 화면 flash @ app/index.tsx:19-30 | §11.1, §17.4
  제안: surface[0] 배경 + BrandMark 중앙 + 스피너 text-brand.
- [P1/state-design/S] 로그인 실패를 시스템 Alert로 표출 — 인라인 에러 경로와 이중화 @ app/(auth)/login.tsx:49 vs 145-154 | §11.3
- [P1/hierarchy/S] 온보딩 타이틀·로그인 서브카피가 타입 스케일 밖 (26/34, 17/26, lineHeight 22) @ onboarding.tsx:145-157, login.tsx:73-84, privacy.tsx:66,130,172 | §2.2, §2.4
  제안: 온보딩 타이틀 = display(32/40)로 격상, 오버라이드 제거.
- [P1/a11y/S] 로그인 히트램프 첫 칸(heat-0)이 라이트모드 흰 배경에 녹아 4칸으로 보임 @ login.tsx:88-102 + HeatRampRow.tsx:39-52 | §4.1
  제안: border.subtle hairline 또는 surface-2 컨테이너 카드.
- [P1/a11y/S] MiniTimeGrid sweep 애니메이션이 모션 감소 설정에 무응답 (무한 루프) @ MiniTimeGrid.tsx:38-68 | §6.4, §12.5
- [P1/interaction/M] 모든 pressed 피드백이 opacity 단일 — brand-600·surface-3 pressed 토큰 미사용 @ login/onboarding/terms 전 버튼 | §6.1, §9.1
- [P1/component-gap/M] 56pt CTA 버튼을 3개 화면이 각자 하드롤 — 공용 Button 부재. 상태 처리 제각각(loading은 login만, disabled 스타일은 terms만) | §17.5, §11.1
- [P2/motion/M] 온보딩 페이지 dot이 8→24pt 스냅 전환, 슬라이드 2·3은 완전 정적 @ onboarding.tsx:183-196, MiniMap/MiniCalendar | §6.5
- [P2/state-design/S] terms·온보딩 진행 CTA가 submitting 중 무피드백, disabled press도 무반응 @ terms.tsx:55-62·200-222, onboarding.tsx:73-80 | §17.5
- [P2/copy/S] 로그인 하단 '동의하는 것으로 간주합니다' — 실제 플로우(다음 화면 명시 동의)와 모순 + 법률 문어체 @ login.tsx:180-186 | §17.6
- [P2/spacing/S] 로그인 좌우 inset space-5(20pt) — 표준 space-4(16pt)와 불일치 @ login.tsx:63 | §5.1
- [P2/hierarchy/S] privacy 위탁 테이블 헤더 배경(surface-1)이 라이트모드에서 일반 행과 동일한 흰색 @ privacy.tsx:290 | §0.3
  제안: surface[2]로 교체.
- (P2 잔여 1건은 위 항목들에 흡수)

## home-tab (12건)

총평: 토큰 준수·빈 상태 카드·스켈레톤 도입 등 기본기는 잡혀 있으나, 상태 설계의 구멍(에러를 빈 상태로 위장, 모임 생성 후 돌아와도 갱신 안 됨, 영구 0인 통계 칩)과 다크모드 CTA 대비 실패가 "미완성" 인상을 만든다.

- [P0/state-design/M] fetch 실패를 조용히 삼켜 에러가 '잡힌 모임이 아직 없어요' 빈 상태로 위장 @ app/(tabs)/index.tsx:32-34 | §11.3, §0 원칙 6
- [P0/interaction/S] 모임 생성 후 홈 복귀 시 목록 미갱신 (mount 1회 fetch + pull-to-refresh 부재) @ index.tsx:26-41 | §11.4
  제안: useFocusEffect refetch + RefreshControl.
- [P1/dark-mode/S] 다크모드에서 메인 CTA 카드의 하드코딩 흰색 rgba 텍스트가 대비 실패 @ index.tsx:120 | §3.2, §3.3
- [P1/interaction/S] 알림 버튼이 Alert('준비 중')로 응답 — 죽은 기능 노출 @ index.tsx:61-77 | §11.3
  제안: 벨 제거(권장) 또는 토스트.
- [P1/state-design/M] 통계 칩 3개가 영구 하드코딩 '0' — 목업 @ index.tsx:305-317 | §17.2, §17.3
  제안: myGroups에서 파생 또는 숨김. 숫자 title-2+tabular-nums 격상.
- [P1/state-design/S] 빈 상태에 CTA 부재 @ index.tsx:264-302 | §11.2
- [P1/hierarchy/M] 모임 카드 위계 2단계 평탄 + '확정됨' 무표정 + 날짜 나열 오버플로 @ index.tsx:249-260 | §17.3
  제안: chevron + 상태 dot·라벨 페어 + 날짜 요약 + 확정 정보 캡션.
- [P2/hierarchy/S] 타입 스케일 이탈: 섹션 타이틀 title-3, CTA 타이틀 Body 20px 오버라이드, 임의 letterSpacing 5곳 @ index.tsx:82-95 | §2.2
- [P2/motion/S] pressed 전부 opacity — 카드는 surface-3, CTA는 brand-600 전환이어야 @ index.tsx:71 | §9.1
- [P2/motion/S] Skeleton 700ms 하드코딩 + 모션 감소 미응답 @ src/components/Skeleton.tsx:29-38 | §11.1, §6.4
- [P2/a11y/S] '지도로 보기' 터치 타깃 약 34pt @ index.tsx:188-202 | §12.1
- [P2/component-gap/M] 카드 쉘 3중 중복 + Toast/EmptyState 부재 @ index.tsx:210-224 | §11.2, §11.3

## friends-tab (19건)

총평: 뼈대는 성실하나 성공·실패 피드백이 전부 시스템 Alert(§11.3 금지)이고 로딩·에러가 빈 화면/스피너/가짜 빈 상태로 처리. Toast·Button·EmptyState 갭이 근본 원인.

- [P0/interaction/M] 성공·실패 피드백 전체가 Alert.alert @ friends/index.tsx:40,71,88,91 | §11.3
- [P0/state-design/S] 친구 목록 첫 로딩이 완전 빈 화면 — 스켈레톤 부재 @ friends/index.tsx:216 | §11.1
- [P0/state-design/M] 네트워크 에러가 '아직 친구가 없어요' 빈 상태로 위장 @ friends/index.tsx:38-44 | §11.3
- [P0/interaction/S] 검색 화면 '카톡으로 친구 초대' 카드가 no-op @ friends/search.tsx:181-184 | §0.6
  제안: useKakaoInvite 훅 추출해 index.tsx 로직 공유.
- [P1/interaction/S] 액션 버튼 in-flight 잠금 부재 — 더블탭 중복 요청 @ search.tsx:62-71 | §17.5
- [P1/interaction/S] 차단이 확인 단계 없이 한 탭 즉시 실행 @ ReportBlockSheet.tsx:49-52 | §10.6
  제안: 시트 내 block-confirm 스텝 추가(멀티스텝 구조 기존재).
- [P1/state-design/S] 검색·요청함 로딩이 전체 화면 ActivityIndicator @ search.tsx:286-289 | §11.1
- [P1/copy/S] 전 친구 카드 '최근 모임 0회' — 항상 undefined 필드 표시 @ FriendCard.tsx:22,73-75 | §17.3
- [P1/interaction/S] 요청함·검색 pull-to-refresh 부재 @ requests.tsx:350-389
- [P1/state-design/S] 받은 요청·모임 초대 탭 빈 상태 CTA 없음 @ requests.tsx:226-248 | §11.2
- [P1/copy/S] '~했습니다'/'~했어요' 톤 혼재 @ requests.tsx:59,81 | §17.6
- [P1/component-gap/L] Toast·Button·EmptyState 부재 — 세 화면이 같은 패턴 5회+ 재구현 | §11.2, §11.3, §17.5
- [P2/motion/M] 탭 인디케이터·시트 스텝 전환 모션 부재 @ requests.tsx:298-341 | §6
- [P2/spacing/S] paddingVertical:5 등 4pt 그리드 이탈 @ FriendRequestCard.tsx:128 | §5
- [P2/state-design/S] 빈 상태 아이콘 처리 화면마다 상이(brand 원 vs 그레이 원) | §11.2, D5
- [P2/a11y/S] 검색 결과 '친구 요청' 버튼 36pt @ search.tsx:376-380 | §12.1
- [P2/copy/S] '님과 모임 만들기' 라벨이 실제로는 일반 생성 화면 이동 @ FriendCard.tsx:39 | §17.6
- [P2/interaction/S] 검색 입력 clear 버튼·returnKeyType·autoFocus 부재 @ search.tsx:271-281
- [P2/state-design/S] 요청함 배지 카운트에 모임 초대 미포함 @ friends/index.tsx:35-37

## map-tab (13건)

총평: 탭 지도 화면이 형제 화면(place-search·midpoint)의 성숙도에서 한 세대 뒤처짐. "죽은 결과 카드"와 "타이핑마다 전체 스피너 점멸"이 즉시 미완성으로 읽힘.

- [P0/interaction/M] 검색 결과 카드가 탭 불가능한 죽은 View @ app/(tabs)/map.tsx:24-62 | §17.1
- [P0/state-design/S] 타이핑마다 리스트가 전체 스피너로 점멸 — Skeleton 미사용 @ map.tsx:65-71 | §11.1
- [P1/state-design/S] 에러 재시도 CTA 없음 + hook이 보존한 이전 결과를 화면이 버림 @ map.tsx:72-85 | §11.3
- [P1/state-design/M] 빈 상태 2종 모두 §11.2 3요소 미충족 @ map.tsx:86-101
- [P1/component-gap/L] 탭 지도만 MapHost/MapPlaceholder 미연결 @ map.tsx:168-191 | D38
- [P1/interaction/S] 검색 입력 clear(X)·returnKeyType 부재 @ map.tsx:154-164
- [P2/state-design/S] OriginInput이 검색 에러 무시 — 실패 시 침묵 @ OriginInput.tsx:34 | §11.3
- [P2/hierarchy/S] 빈 상태 헤드라인 타이포 위계 제각각 @ map.tsx:89 | §11.2
- [P2/dark-mode/S] NaverMapScene 마커 caption 다크 대비 위험 @ NaverMapScene.tsx:59-61 | §12.6
- [P2/motion/S] ActivityIndicator size=large — §11.1 스펙 밖 @ map.tsx:68
- [P2/copy/S] MapPlaceholder 카피에 내부 용어 "정식 앱 빌드가 준비되면" @ MapPlaceholder.tsx:24-32 | §17.6
- [P2/component-gap/S] MapMarkerView order 배지 28pt+11pt — §10.5 스펙(32pt+title-3) 미달 @ MapMarkerView.tsx:19
- [P2/spacing/S] marginTop:2, lineHeight:18 등 리터럴 잔재 @ map.tsx:51

## profile-tab (11건)

총평: 토큰 정합 우수하나 "설정/계정 화면" 성숙도 부족 — 로그아웃 무확인, 탈퇴·정책 링크 부재, 탭 행 절반이 Alert로 끝남.

- [P0/interaction/S] 로그아웃이 확인 없이 즉시 실행 @ profile.tsx:62-65 | §10.6
- [P0/component-gap/L] 회원 탈퇴 진입점 전무 (서버 RPC 포함) @ profile.tsx:112-176
- [P1/interaction/S] 탭 행 3곳이 Alert('준비 중')로 끝남 @ profile.tsx:128 | §11.3
  제안: non-pressable화 + chevron 숨김, 또는 토스트.
- [P1/state-design/M] 캘린더 연결 상태 확인·복구 row 부재 — ReauthModal 닫으면 경로 소실 @ profile.tsx:29-38 | §11.4
- [P1/component-gap/S] 이용약관·개인정보·문의 링크 부재 @ profile.tsx:140-154
- [P1/hierarchy/M] 프로필 카드 위계 2단계 + 콘텐츠 0 @ profile.tsx:87-110 | §17.2, §17.3
  제안: '모임 N · 친구 N' 통계 칩(title-2 tabular-nums).
- [P2/motion/S] SettingRow pressed opacity 0.7 단일 @ profile.tsx:274 | §9.1
- [P2/a11y/S] '준비 중' 상태 스크린 리더 미전달 @ profile.tsx:272 | §12.3
- [P2/state-design/S] ReauthModal busy 스피너 없음 + 'Google' 영문·ASCII 말줄임 @ ReauthModal.tsx:92-93
- [P2/spacing/S] marginTop:4, paddingVertical:2 리터럴 @ profile.tsx:107 | §5
- [P2/component-gap/M] ListItem·ConfirmSheet·Toast 승격 필요 @ profile.tsx:198-281

## tab-shell (7건)

총평: 셸 토큰 준수는 견고하나 IA 명세의 중앙 FAB이 통째로 빠졌고, 셸 인프라(다크 네비 배경, safe area, 공용 헤더, 토스트) 부재로 하위 화면 불일치가 이미 발생.

- [P1/component-gap/L] IA·§10.7 명세의 중앙 '모임 만들기' FAB 부재 @ (tabs)/_layout.tsx | §10.7, §14 D-FAB
- [P1/spacing/S] 탭바 고정 높이가 iOS 홈 인디케이터 safe area 무시 @ _layout.tsx:28-35 | §12.7
- [P1/dark-mode/S] 다크모드 화면 전환 시 네비 기본(라이트) 배경 노출 @ app/_layout.tsx:84-90 | §0.3
- [P1/interaction/M] 모임 자동 합류 모먼트가 시스템 Alert + 존재하지 않는 '모임 탭' 안내 @ _layout.tsx:192-201 | §11.3, §17.6
- [P1/component-gap/M] 공용 ScreenHeader 부재 — 10개 화면 제각각 헤더 @ group/_layout.tsx:7 | §2.2
- [P2/state-design/S] 탭 active가 tint 하나 + 아이콘 22px 임의 값 @ _layout.tsx:11-17 | §9.1
- [P2/motion/S] 루트 Stack 전환 애니메이션 미지정 @ _layout.tsx:84 | §6.5

## group-detail-grid (17건)

총평: 그리드 코어(스켈레톤, VoteGuide, 본인선택 링, 44pt)는 완성도 높음. 클라이맥스 "모임 확정" 모먼트와 에러 표면이 전부 시스템 Alert + raw 메시지, §6 모션 레이어 부재가 급소.

- [P0/interaction/L] 모임 확정 성공이 Alert.alert — 제품 클라이맥스의 디자인 부재 @ app/group/[id]/index.tsx:228-234 | §6.5, §11.3
  제안: ConfirmedTimeCard가 duration-long+emphasized로 등장하는 것이 피드백 + 보조 토스트.
- [P0/state-design/M] 로드 에러가 raw message 한 줄 — 재시도·아이콘 없음 @ index.tsx:120-121 | §11.2
- [P0/state-design/M] 투표 저장·확정 실패 Alert에 raw 메시지 @ index.tsx:175-177 | §11.3
  제안: 토스트/시트 인라인 에러 + mapErrorToKorean 패턴 전역화.
- [P1/hierarchy/S] 그리드 헤더에 요일 없음 — '7/8' 숫자만 @ index.tsx:54-63 | §2.2
  제안: 요일(caption)+날짜(micro tabular-nums) 2줄, luxon KST, ConfirmSlotSheet KO_WEEKDAY 재사용.
- [P1/motion/M] 히트맵 셀 색 전환·heat-4 축하 모션 부재 @ Cell.tsx:33-45 | §6.5
  제안: broadcast 경로(memo+JS state)만 withTiming(short), heat-4 진입 xLong+emphasized. D12 worklet 무접촉.
- [P1/component-gap/S] ConfirmSlotSheet §10.3 미준수 — grabber 없음, radius-xl @ ConfirmSlotSheet.tsx:58-75
- [P1/a11y/M] 셀 a11y 라벨에 날짜·시간 없음 + pan 모드 더블탭 무동작 @ Cell.tsx:48-63 | §12.3
- [P1/interaction/M] 당겨서 새로고침 없음 — 멤버가 호스트 확정을 재진입 전까지 못 봄 @ index.tsx:102-126
- [P1/copy/S] RealtimeStatus '30s'·'폴링' 전문용어 @ RealtimeStatus.tsx:42 | §17.6
- [P1/component-gap/M] 공용 Button 부재 — 한 화면 CTA 5곳 재구현 @ HostConfirmButton.tsx:31-66
- [P1/hierarchy/S] ConfirmedTimeCard 위계 약함 — 확정 시간이 16pt Body @ ConfirmedTimeCard.tsx:39-58 | §17.3
- [P2/motion/M] Reduce Motion 응답 화면 전체 0건 @ Skeleton.tsx:29-38 | §6.4
- [P2/hierarchy/S] 멤버 수·후보일 카운터 tabular-nums 미적용 @ index.tsx:351-353 | §2.3
- [P2/spacing/S] backdrop rgba 하드코딩·9pt 폰트·off-grid 간격 @ ConfirmSlotSheet.tsx:60 | §13
- [P2/dark-mode/S] 다크에서 ConfirmedTimeCard 배경 사실상 투명(brand-50=6% 알파) @ ConfirmedTimeCard.tsx:45-46 | §0.3
- [P2/interaction/M] pressed 전부 opacity @ index.tsx:286 | §9.1
- [P2/copy/S] '확인/취소' 시스템 톤 잔재 @ ConfirmSlotSheet.tsx:187-189 | §17.6
