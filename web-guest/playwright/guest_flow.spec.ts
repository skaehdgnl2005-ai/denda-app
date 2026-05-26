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
    // 모바일 viewport (iPhone 13)
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto(`/g/${E2E_TOKEN}`);

    // mock 그룹 데이터의 모임명 (page.tsx의 NEXT_PUBLIC_IS_E2E 분기)
    await expect(page.getByRole('heading', { name: '안암 저녁 모임' })).toBeVisible();
    await expect(page.getByText('방장: 김방장')).toBeVisible();
    await expect(page.getByText('초대장')).toBeVisible();

    // NicknameForm useEffect의 supabase SELECT fail catch → setIsOpen(true) → 모달 표시.
    // 약간의 backoff (network fail catch까지)을 위해 waitFor.
    await expect(
      page.getByRole('heading', { name: '투표 참여하기' }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('닉네임 입력')).toBeVisible();
    await expect(page.getByRole('button', { name: '확인' })).toBeVisible();

    await context.close();
  });
});
