import { test, expect, devices } from '@playwright/test';

// S14-e2e-flow: full guest user flow E2E.
//
// NEXT_PUBLIC_IS_E2E=true 환경에서 컴포넌트(ClientPage·NicknameForm·GuestTimeGrid)가 supabase
// 호출 skip + 즉시 진행. 닉네임 입력 → 모달 close → 그리드 셀 클릭 → CTA "결과 알림 받으려면 →" 표시.

const E2E_TOKEN = 'e2e-flow-token';

// S14-e2e-flow (2026-05-26): NicknameForm.handleSubmit + GuestTimeGrid.commitVotes의
// NEXT_PUBLIC_IS_E2E 분기 + Turbopack workspace root fix(`next.config.ts`)로 full flow
// stable. modal mount → fill → submit → modal close → cell mousedown → CTA visible.
test.describe('Web Guest Page E2E Flow — 닉네임 입력 → 그리드 셀 select → CTA', () => {
  test('닉네임 → 그리드 셀 select → 본인 슬롯 border-brand-500 + CTA visible', async ({
    browser,
  }) => {
    // mobile viewport 강제 (md:hidden 데스크톱 안내 화면 회피)
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto(`/g/${E2E_TOKEN}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // 1. 닉네임 모달 mount 대기
    const modal = page.locator('div.fixed.inset-0.z-50');
    await modal.waitFor({ state: 'visible', timeout: 15_000 });

    // 2. 닉네임 입력 후 submit
    await modal.locator('#nickname-input').fill('테스터');
    await modal.locator('button[type="submit"]').click();

    // 3. 모달 close
    await expect(modal).not.toBeVisible({ timeout: 5_000 });

    // 4. 시간 그리드 셀 mount 대기
    const firstCell = page.locator('[data-slot-cell]').first();
    await firstCell.waitFor({ state: 'visible', timeout: 5_000 });

    // 5. 셀 mousedown → 본인 선택 (border-brand-500)
    await firstCell.dispatchEvent('mousedown');
    await expect(firstCell).toHaveClass(/border-brand-500/);

    // 6. mouseup으로 drag 종료 + 결과 알림 CTA visible
    await firstCell.dispatchEvent('mouseup');
    await expect(
      page.getByRole('button', { name: /결과 알림 받으려면/ }),
    ).toBeVisible();

    await context.close();
  });
});
