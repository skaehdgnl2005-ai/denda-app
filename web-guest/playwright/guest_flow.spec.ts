import { test, expect, devices } from '@playwright/test';

// S14-e2e-setup — web-guest base flow spec.
//
// supabase 호출 mock 없이 진행 가능한 분기만 검증:
//   1. `/` root page — 안내 메시지
//   2. `/g/[token]` desktop viewport — "모바일에서 열어주세요" 안내 화면 (md:flex)
//   3. `/g/[token]` mobile viewport — 모임 헤더 + 닉네임 모달 ("투표 참여하기")
//
// dummy supabase URL이라 NicknameForm useEffect의 group_guests SELECT는 network fail →
// catch → setIsOpen(true) → 모달 표시. ClientPage fetchData도 catch → setLoading(false).
//
// 시간 그리드 투표 → CTA user flow는 mock supabase 응답 필요 → 별도 sub-task.

const E2E_TOKEN = 'e2e-token-123';

test.describe('web-guest base flow (supabase mock 없이 진행 가능한 분기)', () => {
  test('/ root page — 모임 초대 안내 메시지 렌더', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '된다 (DenDa)' })).toBeVisible();
    await expect(page.getByText('모임 초대 링크로 접속해 주세요.')).toBeVisible();
  });

  test('/g/[token] desktop viewport — "모바일에서 열어주세요" 안내 화면', async ({ browser }) => {
    // 데스크톱 viewport 강제 (project=desktop-chromium에서 실행 — 본 케이스는 그 project 한정)
    const context = await browser.newContext({ ...devices['Desktop Chrome'] });
    const page = await context.newPage();
    await page.goto(`/g/${E2E_TOKEN}`);

    await expect(page.getByRole('heading', { name: '모바일에서 열어주세요' })).toBeVisible();
    await expect(
      page.getByText(/된다 모임 시간 투표는 모바일 화면에 최적화되어 있습니다/),
    ).toBeVisible();

    await context.close();
  });

  test('/g/[token] mobile viewport — 모임 헤더 + 닉네임 모달', async ({ browser }) => {
    // S14-e2e-stability fix (2026-05-26): Turbopack workspace root 자동 감지 실패가 root cause
    // 였음. `web-guest/package-lock.json`과 부모 `denda-app/package-lock.json` 둘 다 존재 → 부모
    // 루트로 잘못 잡혀 "Next.js package not found" panic + Fast Refresh 무한 rebuild → 클라
    // hydration 미완 → 모달 useEffect 못 돔. `next.config.ts::turbopack.root = __dirname`으로 해소.
    // 모바일 viewport (iPhone 13)
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto(`/g/${E2E_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // mock 그룹 데이터의 모임명 (page.tsx의 NEXT_PUBLIC_IS_E2E 분기)
    await expect(page.getByRole('heading', { name: '안암 저녁 모임' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('방장: 김방장')).toBeVisible();
    await expect(page.getByText('초대장')).toBeVisible();

    // NicknameForm useEffect의 NEXT_PUBLIC_IS_E2E 분기 → setIsOpen(true) 즉시. 모달 mount.
    // modal scope 안에서 검색해 flaky mount 타이밍 회피.
    const modal = page.locator('div.fixed.inset-0.z-50');
    await modal.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(modal.getByRole('heading', { name: '투표 참여하기' })).toBeVisible();
    await expect(modal.locator('#nickname-input')).toBeVisible();
    await expect(modal.locator('button[type="submit"]')).toBeVisible();

    await context.close();
  });

  test('/g/[token] 카톡 OG 메타 — server-rendered metadata', async ({ page }) => {
    // SSR(`generateMetadata` in app/g/[token]/page.tsx)이 카톡 공유 시 OG 카드 렌더링용 meta를
    // HTML head에 inject. NEXT_PUBLIC_IS_E2E=true 분기로 mock group("안암 저녁 모임" + "김방장")이
    // metadata 생성에 사용.
    const response = await page.goto(`/g/${E2E_TOKEN}`);
    expect(response?.status()).toBe(200);

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBe('안암 저녁 모임 | 모임 시간 투표 - 된다');

    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    expect(ogDescription).toContain('김방장');
    expect(ogDescription).toContain('모임에 초대했습니다');

    const ogType = await page.locator('meta[property="og:type"]').getAttribute('content');
    expect(ogType).toBe('website');

    const ogSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content');
    expect(ogSiteName).toBe('된다 (DenDa)');

    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    expect(ogUrl).toBe(`https://denda.vercel.app/g/${E2E_TOKEN}`);

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/\/og_image\.png$/);
  });
});

// S14-e2e-realtime — `votes_aggregate` Edge Function broadcast(D11) 수신 path 검증.
//
// GuestTimeGrid의 realtime useEffect가 E2E mode에서 노출하는
// `window.__dendaE2E_triggerHeatmapBroadcast`를 호출해 핸들러를 흉내내고, page.route로
// supabase /rest/v1/votes endpoint를 intercept해 refreshVotes 호출 여부를 검증한다.
//
// 실제 broadcast payload spec(day_index 등)은 S05a votes_aggregate Edge Function의 책임이며
// Q-B21 closed entry에서 확정. 본 spec은 클라이언트의 listen-and-refresh path만 검증한다.
test.describe('Realtime broadcast listen path — heatmap_update → refreshVotes', () => {
  test('broadcast 트리거 시 /rest/v1/votes REST refresh 호출', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();

    let votesFetchCount = 0;
    await page.route('**/rest/v1/votes**', async (route) => {
      votesFetchCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(`/g/${E2E_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // 닉네임 입력 → guestToken set → GuestTimeGrid mount → realtime useEffect 실행
    const modal = page.locator('div.fixed.inset-0.z-50');
    await modal.waitFor({ state: 'visible', timeout: 15_000 });
    await modal.locator('#nickname-input').fill('테스터');
    await modal.locator('button[type="submit"]').click();

    // GuestTimeGrid cell mount + window trigger 노출 대기
    await page.locator('[data-slot-cell]').first().waitFor({ state: 'visible', timeout: 5_000 });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              typeof (window as Window & { __dendaE2E_triggerHeatmapBroadcast?: () => void })
                .__dendaE2E_triggerHeatmapBroadcast === 'function',
          ),
        { timeout: 5_000 },
      )
      .toBe(true);

    const beforeCount = votesFetchCount;

    // broadcast 핸들러 수동 트리거 (votes_aggregate Edge Function의 `heatmap_update` 흉내)
    await page.evaluate(() => {
      const w = window as Window & { __dendaE2E_triggerHeatmapBroadcast?: () => void };
      w.__dendaE2E_triggerHeatmapBroadcast?.();
    });

    // refreshVotes가 supabase /rest/v1/votes endpoint hit 검증
    await expect.poll(() => votesFetchCount, { timeout: 5_000 }).toBeGreaterThan(beforeCount);

    await context.close();
  });
});
