import { expect, test } from '@playwright/test'

test('opens the login page for signed-out users', async ({ page }) => {
    await page.route('**/api/v1/auth/session', async (route) => {
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'unauthorized' }),
        })
    })

    await page.goto('/login')

    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Sign in' }),
    ).toBeVisible()
})
