# RN 화면·컴포넌트 → Figma 레이어 이식 도구 (설계)

**날짜**: 2026-07-28 · **상태**: 구현 완료 · **위치**: `tools/figma-export/`

## 1. 문제

앱 화면·컴포넌트가 코드에만 존재한다. Figma에 디자인 시스템 라이브러리가 없어
시안 작업·팀 공유·문서화를 할 때마다 처음부터 다시 그려야 한다.

## 2. 범위 확정

| 질문 | 결정 |
|---|---|
| 대상 | 공용 컴포넌트 카탈로그 **+** 실제 화면 (컴포넌트 먼저, 화면은 그 조합) |
| 갱신 모델 | **일회성 부트스트랩**. 재실행 시 새로 그린다. 노드 ID 매핑·머지 없음 |
| 좌표 확보 | **정적 트리 덤프 → Auto Layout 재구성** (실기기 실측 좌표 방식 기각) |

**Auto Layout 재구성을 택한 이유**: 화면을 컴포넌트 조합으로 만들려면 컴포넌트가
편집 가능한 Auto Layout이어야 한다. 실측 절대 좌표는 픽셀 정확하지만 박제된
레이아웃이라 Figma에서 아무것도 못 고친다 — "둘 다" 목표와 양립 불가.

## 3. 아키텍처

```
fixtures ──render(light)──┐
                          ├─→ RTL 트리 ──normalize──→ IR ──→ out/parts/*.json
         ──render(dark)───┘                                        │
                                                            merge  ▼
                                          [Figma 플러그인] ←── out/dump.json
```

| 유닛 | 책임 | 의존 |
|---|---|---|
| `fixtures.tsx` | 무엇을 그릴지 선언 | 앱 컴포넌트 |
| `color.ts` | RN 색 문자열 → Figma RGB + alpha | 없음 |
| `svg.ts` | react-native-svg 서브트리 → SVG 문자열 | 없음 |
| `style.ts` | RN 스타일 → Auto Layout/박스/텍스트 | `color`, `ir` |
| `normalize.ts` | 트리 워킹 + margin 파이프라인 → IR | `style`, `svg`, `ir` |
| `*.dump.tsx` | 렌더 2패스 → 파트 JSON | Jest, 위 전부 |
| `plugin/code.ts` | IR → Figma 노드 (판단 없음, 받아쓰기만) | IR 타입만 |

**IR(`ir.ts`)이 유일한 계약**이다. `normalize`는 Figma를 모르고, 플러그인은 RN을 모른다.
IR 필드명은 Figma Plugin API에 맞춰 두어 플러그인 코드를 멍청하게 유지한다.

`normalize`·`style`·`svg`·`color`는 순수 함수라 Figma를 켜지 않고 Jest로 전수 검증된다.

## 4. 적대적 검증에서 뒤집힌 것

설계 초안을 서브에이전트 12개(조사 6 → 반박 6)로 검증했고 **6개 주제 중 5개가 major로 반박**됐다.
반영한 정정:

| # | 초안의 오류 | 실제 |
|---|---|---|
| 1 | 노드마다 프레임 생성 | RN `<View>`는 composite→host 체인으로 **같은 스타일을 두 번** 방출. host만 승격하지 않으면 padding이 2배 |
| 2 | 텍스트 색 매핑 누락 | `color → TextNode.fills`가 초안에 아예 없었다. "배경 없으면 `fills=[]`"를 텍스트에 적용하면 **모든 라벨이 투명** — 그래서 그 규칙은 **FRAME 한정** |
| 3 | `alignItems:'stretch'` → `counterAxisAlignItems` | Figma `counterAxisAlignItems`에 STRETCH가 **없다**. stretch는 부모가 아니라 **자식의 layoutAlign** |
| 4 | `fontFamily: 'PretendardVariable'` 그대로 로드 | 그건 expo-font 등록 키다. OS 폰트명은 `'Pretendard Variable'`(공백). 폰트 바이너리 nameID 파싱으로 확인 |
| 5 | weight는 400/500/600/700 | `BrandMark.tsx:41`이 `'800'` 사용 — 매핑 테이블에 없어 조용히 Regular로 떨어질 뻔 |
| 6 | margin 잔차를 자식 padding으로 | Figma에서 padding은 FRAME 전용. margin 285건 중 **45%가 Text 노드** → 래퍼 프레임 필요 |
| 7 | `PressabilityDebugView` 미인지 | 스타일 없는 팬텀 노드가 자식 수를 오염시켜 n-1 간격 산술을 깨뜨린다 |

Figma API 사실은 전부 `@figma/plugin-typings` 1.131.0 **원문 대조**로 확정했다
(`counterAxisAlignItems`, `primaryAxisAlignItems`, `layoutGrow` 0/1 제한,
`DropShadowEffect`의 `visible`·`blendMode` 필수, `x/y`는 auto-layout 자식에서 no-op).

## 5. margin 파이프라인

Figma Auto Layout에는 margin이 없다. 이 저장소에는 margin이 285건, gap이 25건 —
무시하면 세로 리듬이 통째로 사라진다. 4단계로 옮긴다:

1. **가장자리 margin → 부모 padding** (무손실, 신규 노드 0)
2. **내부 간격의 최솟값 → itemSpacing** (기존 `gap`과 합산)
3. **잔차 → 자식 자체 padding** — 도색되지 않은 HUG **프레임**일 때만
4. **나머지 → 투명 래퍼 프레임** (`X · margin`) — 텍스트·도색 노드가 여기로

## 6. 충실도 정책

**표현 못 하는 것을 조용히 근사하지 않는다.** 화이트리스트에 없는 스타일 속성을 만나면
경고를 남기고, 플러그인이 해당 레이어 이름 앞에 `⚠️`를 붙인다 — 문서 경고보다
Figma 캔버스에서 눈으로 찾는 편이 훨씬 빠르다.

알려진 한계:

| 대상 | 결과 |
|---|---|
| View/Text/색/간격/모서리/테두리 | 거의 무손실 |
| lucide 아이콘 | SVG path 재구성 → 벡터. 무손실 (`fill="none"` 강제 주입 필수) |
| 그림자 | DROP_SHADOW 근사. `shadowRadius` 배율은 캘리브레이션 대상 (`SHADOW_RADIUS_SCALE`) |
| `transform` (스피너 회전 등) | 미이관 + ⚠️ |
| 퍼센트 폭 (100% 외) | HUG로 대체 + ⚠️ |
| `flex:1` 형제 2개 이상 | RN은 basis:0 균등 분배, Figma FILL은 콘텐츠 가중 → 폭이 갈릴 수 있음 |
| right/bottom 기준 절대 배치 | 부모 크기를 몰라 좌표 미확정 + ⚠️ (앱 전체 16곳) |
| 네이버 지도·이미지 asset | 점선 플레이스홀더 |

## 7. 명시적 비목표

- **컴포넌트 자동 인스턴스화** — 일회성 부트스트랩에 과하다. 대신 IR에 `componentRef`를
  남기고 레이어 이름을 컴포넌트명으로 맞춰, 나중에 Figma에서 손으로 묶기 쉽게 한다.
- **yoga-layout 재구현** — 절대 배치 16곳을 위해 레이아웃 엔진을 다시 짜는 건 손으로
  옮기는 것보다 비싸다.
- **재동기화** — 코드↔Figma 양방향 머지는 범위 밖.

## 8. 검증

- 순수 로직 **104 테스트** (`npm test`에 포함)
- 그중 통합 테스트 1건은 **실제 `Button`을 렌더**해 IR 전 필드를 검증 —
  높이 56 · FILL · HORIZONTAL · CENTER/CENTER · padding 20 · radius 8 · brand-500 fill ·
  유령 스트로크 없음 · itemSpacing 8(margin 접힘) · 흰 라벨 · `fill="none"` 아이콘
- 플러그인 런타임은 Figma API 샌드박스(`figma:verify`)로 검증 — 번들을 실제 dump.json으로
  끝까지 실행해 enum 허용값·폰트 로드 순서·SVG 파싱·`resize` 하한을 확인한다.
  Pretendard 설치/미설치 두 시나리오 모두 오류 0건
- 실제 산출: **아트보드 136개** = 컴포넌트 30종 + 화면 20종(상태 38개), 각 라이트/다크.
  레이어 8,766개, 경고 38건(6종)

### 화면 러너를 그룹별로 나눈 이유

`jest.mock`은 모듈 스코프라 여러 화면을 한 파일에 넣으면 mock이 충돌한다. Jest는 테스트
파일마다 모듈 레지스트리를 새로 주므로, 화면 그룹마다 `screens.<group>.dump.tsx`를 두면
각 화면이 자기 테스트와 **똑같은 환경**에서 렌더된다. 파트 병합 구조(`out/parts/*.json`)가
이를 그대로 지원해 러너를 추가해도 배선이 늘지 않는다.

## 9. 사용법

```bash
npm run figma           # dump → merge → typecheck → build → verify
npm run figma:preview   # Figma 없이 결과를 브라우저에서 확인
```

Figma 데스크톱 → Plugins → Development → Import plugin from manifest… →
`tools/figma-export/plugin/manifest.json` 선택 후 실행.
`라이트` / `다크` 두 페이지가 생성된다.

화면을 추가하려면 해당 그룹의 `screens.<group>.dump.tsx`에 항목을 넣고, 그 화면의
`tests/screens/*.test.tsx`에 있는 `jest.mock` 블록을 복사해 온다.
새 그룹은 `screens.home.dump.tsx`를 복사해 `emitPart` 이름과 `group` 라벨만 바꾸면 된다.
