# figma-export — RN 화면·컴포넌트를 Figma 레이어로

앱 코드를 그대로 Figma의 **편집 가능한 Auto Layout 레이어**로 옮긴다.
스크린샷이 아니라 진짜 레이어 — 텍스트를 늘리면 버튼도 같이 늘어난다.

설계 배경·검증 기록: [docs/superpowers/specs/2026-07-28-rn-figma-export-design.md](../../docs/superpowers/specs/2026-07-28-rn-figma-export-design.md)

## 쓰는 법

```bash
npm run figma
```

그다음 Figma **데스크톱 앱**에서:

1. Plugins → Development → **Import plugin from manifest…**
2. `tools/figma-export/plugin/manifest.json` 선택
3. Plugins → Development → **된다 — RN 화면 이식** 실행

`라이트` · `다크` 두 페이지가 생기고 그룹별로 배치된다 — **아트보드 136개**:

| 그룹 | 내용 |
|---|---|
| Foundations · Buttons · States · Navigation · Inputs · Sheets · Brand | 컴포넌트 카탈로그 30종 |
| 인증 화면 | 로그인(기본·인증 중·오류) · 온보딩 · 약관 · 개인정보 · 법적 고지 |
| 홈 화면 | 빈 상태 · 확정 모임 |
| 탭 화면 | 지도(초기·결과·실패) · 프로필(기본·캘린더 끊김) |
| 친구 화면 | 목록(있음·빈) · 요청함(받은·보낸·초대) · 검색(초기·결과) |
| 모임 화면 | 새 모임 · 모임 상세(로딩·투표 중·추천 시트·확정) · 초대 · 장소 검색 · 장소 시트 |
| 일정 화면 | 에브리타임(입력·인식 중·확인) · 일정 지도(리스트·빈·지도 모드) |

> **폰트**: Pretendard Variable이 로컬에 설치돼 있으면 타이포가 정확히 재현된다.
> 없으면 Inter로 대체하고 실행 후 알림으로 알려준다 (레이아웃은 그대로).

## 개별 단계

| 명령 | 하는 일 |
|---|---|
| `npm run figma:dump` | 픽스처를 라이트/다크로 렌더 → `out/parts/*.json` |
| `npm run figma:merge` | 파트 병합 → `out/dump.json` |
| `npm run figma:typecheck` | 플러그인을 공식 Figma 타이핑으로 검사 |
| `npm run figma:build` | dump.json을 코드에 번들 → `plugin/code.js` |
| `npm run figma:verify` | Figma API 샌드박스에서 플러그인을 끝까지 실행 (Figma 없이 런타임 검증) |
| `npm run figma:preview` | IR을 HTML로 재현 → `out/preview.html` (Figma 없이 눈으로 확인) |

`out/`과 `plugin/code.js`는 생성물이라 커밋하지 않는다.

### Figma를 열기 전에 확인하는 법

- `figma:verify` — Figma Plugin API를 흉내 낸 샌드박스에서 번들을 실제로 돌린다.
  enum 허용값·폰트 로드 순서·SVG 파싱·`resize` 하한 같은 실제 제약을 검사하고,
  **Pretendard 설치/미설치 두 시나리오**를 모두 돌려 폴백 경로까지 확인한다.
  플러그인 코드는 Figma 런타임 안에서만 도는 탓에 다른 테스트가 닿지 않는 유일한 지점이다.
- `figma:preview` — 같은 IR을 CSS flexbox로 렌더한 HTML. Figma가 그릴 간격·정렬·색을
  브라우저에서 그대로 볼 수 있다.

## 대상 추가하기

**컴포넌트** — [fixtures.tsx](fixtures.tsx)의 `fixtures` 배열에 항목 추가:

```tsx
{
  id: 'button/new-variant',
  group: 'Buttons',
  name: '새 변형',
  element: <Button label="확인" onPress={noop} variant="ghost" />,
}
```

**화면** — 해당 그룹의 `screens.<group>.dump.tsx`의 `screens` 배열에 추가한다.
그 화면의 `tests/screens/*.test.tsx`에 있는 `jest.mock` 블록을 파일 상단으로 복사하면 된다 —
이미 통과가 검증된 세트라 그대로 동작한다.

**새 그룹**을 만들 때는 `screens.home.dump.tsx`를 복사해 `emitPart('screens-<id>', …)`와
아트보드의 `group` 라벨만 바꾼다. 병합은 `out/parts/*.json`을 전부 주워가므로 추가 배선이 없다.

> **왜 그룹마다 파일이 하나인가**: `jest.mock`은 모듈 스코프라 여러 화면을 한 파일에 넣으면
> mock이 서로 충돌한다. Jest는 테스트 파일마다 모듈 레지스트리를 새로 주므로 파일을 나누면
> 각 화면이 자기 테스트와 똑같은 환경에서 렌더된다.

## 구조

```
fixtures.tsx      컴포넌트 카탈로그 선언
screens.*.dump.tsx  화면 러너 (그룹당 하나 — mock 격리)
color.ts          RN 색 문자열 → Figma RGB (hex·rgba·이름·transparent)
svg.ts            react-native-svg 서브트리 → SVG 문자열
style.ts          RN 스타일 → Auto Layout · 박스 · 텍스트
normalize.ts      트리 워킹 + margin 파이프라인 → IR
ir.ts             ★ 유일한 계약. normalize는 Figma를, 플러그인은 RN을 모른다
emit.ts           파트 출력 + 요약 로깅
*.dump.tsx        Jest 러너 (라이트/다크 2패스)
plugin/code.ts    IR → Figma 노드. 판단 없이 받아쓰기만
```

`color`·`svg`·`style`·`normalize`는 순수 함수라 `npm test`에서 104개 테스트로 검증된다
(실제 `Button`을 렌더해 IR을 전수 대조하는 통합 테스트 포함).

## ⚠️ 레이어를 보게 되면

충실도가 보장되지 않는 지점이다. Figma에서 레이어 이름 앞의 `⚠️`를 검색하면
전부 찾을 수 있다. 대표 원인:

- `transform` (스피너 회전 등) — Figma로 옮기지 않음
- 퍼센트 폭 (100% 외) — HUG로 대체
- right/bottom 기준 절대 배치 — 부모 크기를 몰라 좌표 미확정
- 네이버 지도 · 이미지 asset — 점선 플레이스홀더

전체 목록은 실행 시 콘솔 요약과 플러그인 완료 알림에 나온다.

## 알아둘 한계

- **일회성 부트스트랩이다.** 재실행하면 새 페이지에 다시 그린다 — 기존 Figma 작업을
  갱신하지 않는다.
- **컴포넌트 인스턴스로 묶지 않는다.** 레이어 이름과 `componentRef`를 컴포넌트명에
  맞춰 두었으니 Figma에서 손으로 묶으면 된다.
- **`flex:1` 형제가 2개 이상이면** RN(균등 분배)과 Figma(콘텐츠 가중)의 폭이 갈릴 수 있다.
- **그림자 blur 배율**(`SHADOW_RADIUS_SCALE`)은 근사치다. 실물 대조 후 조정할 수 있게
  [style.ts](style.ts) 상단에 상수로 빼 두었다.
