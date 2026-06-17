import { expect, test, type Page } from '@playwright/test'

const credentials = {
    email: 'stride@test.com',
    password: 'StridePass123!',
}

const mockSession = async (page: Page, isAuthenticated: () => boolean) => {
    await page.route('**/api/v1/auth/session', async (route) => {
        if (!isAuthenticated()) {
            await route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'unauthorized' }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'user-1',
                username: 'strideuser',
                email: credentials.email,
                full_name: 'Stride User',
                avatar_url: null,
                is_superuser: false,
            }),
        })
    })
}

test('opens the login page for signed-out users', async ({ page }) => {
    await mockSession(page, () => false)

    await page.goto('/login')

    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Sign in' }),
    ).toBeVisible()
})

test('signs in with valid credentials', async ({ page }) => {
    let isAuthenticated = false
    await mockSession(page, () => isAuthenticated)

    await page.route('**/api/v1/auth/login', async (route) => {
        const body = await route.request().postData()

        expect(body).toContain('email=stride%40test.com')
        expect(body).toContain('password=StridePass123%21')
        isAuthenticated = true

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ok: true }),
        })
    })

    await page.goto('/login')

    await page.getByLabel('Email').fill(credentials.email)
    await page.getByPlaceholder('Enter your password').fill(
        credentials.password,
    )
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/')
})
