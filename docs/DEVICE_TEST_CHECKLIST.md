# 실기기 테스트 체크리스트

> `/run-denda-device`가 참조하는 실기기 검증 항목. 테스트 세션마다 필요한 섹션만 골라 진행.
> preview(release) 빌드 필수 항목은 **[P]** 표기 — dev client에서 측정 금지 (testing 규칙).

## 0. 사전 준비 (환경 — 테스트 전 1회)

- [ ] `.env`에 `EXPO_PUBLIC_NAVER_MAP_CLIENT_ID` + `EXPO_PUBLIC_MAP_ENABLED=true` (없으면 지도는 MapPlaceholder)
- [ ] `supabase functions deploy naver_local_search` 배포 여부 — 미배포면 장소 검색이 "버그처럼" 실패
- [ ] 실기기용 빌드의 keyHash가 카카오 콘솔에 등록 (EAS 빌드 vs 로컬 debug는 서명이 다름 → hash도 다름)
- [ ] dev client 최신 (네이티브 의존성·patch-package 변경 후 재빌드했는지)

## 1. 콜드 스타트 · 부팅 [P]

- [ ] 완전 종료 → 재실행 cold start < 2초 (`adb shell am start -W com.denda.app/.MainActivity` — S13 잔여 "전체 권위 숫자")
- [ ] 스플래시 → 첫 화면 전환 시 흰 화면 깜빡임 없음
- [ ] Pretendard가 첫 프레임부터 적용 (FOUT 없음)
- [ ] 비행기 모드에서 실행 → 크래시 없이 에러 EmptyState

## 2. 카카오 로그인 (실기기 전용 경로)

- [ ] 카카오톡 설치된 폰: 로그인 → 카톡 앱 전환 → 복귀 (에뮬은 웹뷰 폴백이라 이 경로 미검증)
- [ ] 인증 중 뒤로가기 / 앱 전환 후 복귀 → 무한 로딩 없음
- [ ] 탈퇴(W1-14) → 재로그인 전체 사이클

## 3. 시간 그리드 60fps [P] (S05e 공식 잔여 — 회사 운명)

- [ ] 드래그 sweep 프레임 드랍 없음 (`adb shell dumpsys gfxinfo com.denda.app` 또는 PERF_OVERLAY)
- [ ] 기기 2대(또는 폰+에뮬) 동시 투표 → 상대 히트맵 실시간 반영 + 수신 중 내 드래그 안 끊김 (D11)
- [ ] 저사양 기기(Galaxy A14급, P1 페르소나)에서 동일 확인
- [ ] 빠른 반복 sweep에도 vote 커밋 1회 (중복 없음)

## 4. 지도 (MapHost — feat/map-maphost-m0 핵심)

- [ ] 네이티브 지도 실렌더: 마커·폴리라인·중간점·제휴 강조 (M0~M4 첫 실기기 검증)
- [ ] 지도 제스처(핀치·회전·드래그) vs 스크롤뷰/탭 제스처 충돌 없음
- [ ] 지도 탭 첫 진입 lazy load 지연 체감 없음 (D25)
- [ ] 마커 탭 → PlaceActionSheet 슬라이드 모션 자연스러움
- [ ] "예약하기" 더블 탭 → 이벤트 1회만 로깅 (Gate #2 critical path)

## 5. 딥링크 · 초대 (S15)

- [ ] 초대 링크 → 실제 카카오톡 대화방 공유 → 미리보기 카드 → 탭 → 앱 열림
- [ ] 미설치 시나리오: 링크 → 스토어/웹 게스트 → 설치 후 attribution 매칭 (D28)
- [ ] 앱 백그라운드/종료 각 상태에서 링크 탭 → 올바른 화면 착지

## 6. 푸시 알림 (S12 — 에뮬 사실상 불가)

- [ ] 권한 허용/거부 각각 처리
- [ ] foreground / background / 종료 3상태 수신
- [ ] 알림 탭 → 해당 모임 화면 착지
- [ ] F4 중복 발송 없음 (D17)
- [ ] 절전 모드에서 수신 (삼성 배터리 최적화 이슈)

## 7. 캘린더 (S06)

- [ ] 권한 거부 시 한국어 안내, 크래시 없음
- [ ] 모임 확정 → 기기 캘린더에 KST 시간 정확 등록
- [ ] 삼성 캘린더 / Google 캘린더 계정별 동작

## 8. 시간대 · KST (D13)

- [ ] 폰 시간대를 해외로 변경 → 그리드·확정 시간 여전히 KST + "KST 기준으로 표시 중" 라벨
- [ ] 자정 경계(24:00) 슬롯 날짜 표시

## 9. 다크모드 · 접근성

- [ ] 시스템 다크 실시간 토글 → 전 화면 즉시 반영·대비 확인 (S11 다크 검증 deferred 소화)
- [ ] 모션 감소 ON → ConfirmedTimeCard 등장·PlaceActionSheet 슬라이드·Toast 감속/생략
- [ ] 시스템 글자 크기 최대 → 레이아웃 깨짐 없음 (그리드 헤더·버튼 라벨)
- [ ] TalkBack으로 주요 플로우 1회 — accessibilityLabel 낭독 확인

## 10. 실기기 특유 잡버그

- [ ] 키보드: SearchField·OriginInput 가림 없음, 키보드 열린 채 화면 전환 시 레이아웃 유지
- [ ] 노치·펀치홀·제스처 내비: 탭바 safe area (W2-1)
- [ ] 화면 꺼짐 → 재개 시 Realtime 재연결 (RealtimeStatus 정상)
- [ ] Wi-Fi ↔ LTE 전환 중 요청 → 에러 Toast + 재시도 동작
- [ ] 이미지 피커(everytime OCR): 실제 카메라 촬영 + 대용량 갤러리 사진 업로드
- [ ] 물리 뒤로가기: 각 화면에서 이전 화면으로 (앱 종료 아님)

## 우선순위 (feat/map-maphost-m0 기준)

§0 사전준비 → §4 지도 → §3 60fps(S05e 잔여 마감) → §2 카카오 로그인. §1 cold start는 preview 빌드 만든 김에 같이.
