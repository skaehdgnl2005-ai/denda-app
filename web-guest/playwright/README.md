# web-guest Playwright E2E

TEST_PLAN.md "Web guest E2E" tier — Vercel + Next.js의 사용자 flow 검증.

## 첫 셋업 (1회)

```bash
cd web-guest
npm run e2e:install   # 또는 npx playwright install (Chromium · WebKit 다운로드)
```

브라우저 바이너리는 `~/AppData/Local/ms-playwright/` (Windows) 또는 `~/.cache/ms-playwright/` (Unix)에 받는다. CI 환경은 별도 docker image (`mcr.microsoft.com/playwright`) 권장.

## 실행

```bash
npm run e2e          # headless, 모든 project (mobile-safari · mobile-chromium · desktop-chromium)
npm run e2e:ui       # Playwright UI mode (디버그)
npx playwright test --project=mobile-safari   # 특정 project만
npx playwright test playwright/guest_flow.spec.ts --headed   # 브라우저 창 보이기
```

webServer는 `npm run dev`를 자동 spawn. dev server가 이미 떠 있으면 재사용(`reuseExistingServer`).

## 환경 변수

`playwright.config.ts::webServer.env`가 dummy 주입:

| Key | Value | 이유 |
|---|---|---|
| `NEXT_PUBLIC_IS_E2E` | `true` | `app/g/[token]/page.tsx::getGroup`이 mock 그룹 데이터 사용 (실 supabase fetch 안 함) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://e2e-dummy.supabase.co` | `lib/supabase.ts` import-time throw 회피. 실제 fetch는 network fail → catch 분기 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `e2e-dummy-anon-key` | 동상 |

실 supabase에 연결하려면 `.env.local`에 진짜 값을 두고 `webServer.env`를 제거하거나 `process.env`로 override.

## Base spec 범위 (S14-e2e-setup, 2026-05-26)

`guest_flow.spec.ts` 3 케이스:

1. **`/` root** — 모임 초대 안내 메시지 렌더
2. **데스크톱 `/g/[token]`** — "모바일에서 열어주세요" 안내 화면 (DESIGN §12.7)
3. **모바일 `/g/[token]`** — 모임 헤더(`안암 저녁 모임`) + 닉네임 모달(`투표 참여하기`)

dummy supabase URL이라 NicknameForm의 group_guests SELECT는 network fail → catch → 모달 표시. ClientPage fetchData도 catch → loading 해제.

## 향후 sub-task

- **시간 그리드 투표 → CTA user flow** — supabase RPC `save_guest_votes` mock 응답 필요. `page.route('**/e2e-dummy.supabase.co/**', ...)`로 intercept + JSON fixture 응답.
- **Realtime broadcast 수신 시 cell 업데이트** — S05a Edge Function payload spec(D11 day_index) 확정 후
- **카톡 OG 메타 검증** — Playwright의 `page.locator('meta[property="og:title"]')`로 server-rendered metadata 확인
- **시각 회귀 (선택)** — Playwright의 `toHaveScreenshot()` 또는 Chromatic 통합
