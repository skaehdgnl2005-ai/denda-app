import { test, expect } from '@playwright/test';

// S14-e2e-setup (2026-05-26): skeleton 백필 시점의 full user flow spec. supabase RPC mock route는
// 셋업되어 있으나 닉네임 submit·드래그 select·voting 통합은 별도 sub-task로 분리.
// NEXT_PUBLIC_IS_E2E 분기로 supabase 호출 skip된 상태에서는 RPC 경로가 dead path라 본 spec은
// 의도적으로 skip. unskip 조건: (1) 컴포넌트에서 NEXT_PUBLIC_IS_E2E 분기 제거 후 mock route 의존
// 또는 (2) e2e mode에서도 NicknameForm.handleSubmit이 mock 응답 처리하도록 분기 추가
test.describe.skip('Web Guest Page E2E Flow — S14-e2e-flow 별도 sub-task', () => {
  const MOCK_GROUP_ID = '812374df-51d4-4154-b835-b9a5ac03082e';

  test.beforeEach(async ({ page }) => {
    // Intercept Supabase API calls and return mock data
    await page.route('**/rest/v1/groups*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: MOCK_GROUP_ID,
          name: '안암 저녁 모임',
          dates: ['2026-05-24', '2026-05-25'],
          host_id: 'host-123',
          users: { nickname: '김방장' },
        }),
      });
    });

    await page.route('**/rest/v1/group_members*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            joined_at: '2026-05-23T22:43:05+09:00',
            user: { id: 'host-123', nickname: '김방장' },
          },
        ]),
      });
    });

    await page.route('**/rest/v1/group_guests*', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            guest_token: 'guest-token-123',
            group_id: MOCK_GROUP_ID,
            nickname: '테스터',
            created_at: '2026-05-23T22:43:05+09:00',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.route('**/rest/v1/votes*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/rest/v1/rpc/save_guest_votes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });
  });

  test('should enter nickname, drag select a cell, and complete voting', async ({ page }) => {
    // 1. Visit the route
    await page.goto(`/g/${MOCK_GROUP_ID}`);

    // 2. Validate Nickname modal is shown
    const nicknameInput = page.locator('#nickname-input');
    await expect(nicknameInput).toBeVisible();

    // 3. Fill in nickname and submit
    await nicknameInput.fill('테스터');
    await page.click('button[type="submit"]');

    // 4. Modal should close
    await expect(nicknameInput).not.toBeVisible();

    // 5. Grid cell should be visible
    const cell = page.locator('[data-slot-cell]').first();
    await expect(cell).toBeVisible();

    // 6. Simulate clicking/mousedown on a cell to select it
    await cell.dispatchEvent('mousedown');
    
    // 7. Verify cell gains the selection styling (purple border)
    await expect(cell).toHaveClass(/border-brand-500/);

    // 8. Verify share CTA is visible
    const shareButton = page.locator('#share-button');
    await expect(shareButton).toBeVisible();
  });
});
