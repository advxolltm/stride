import { expect, test, type Page } from '@playwright/test'

const credentials = {
    username: 'strideuser',
    email: 'stride@test.com',
    password: 'StridePass123!',
}

const signedOutSession = async (page: Page) => {
    await page.route('**/api/v1/auth/session', async (route) => {
        await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'unauthorized' }),
        })
    })
}

test('creates an account with valid registration data', async ({ page }) => {
    await signedOutSession(page)

    await page.route('**/api/v1/users', async (route) => {
        expect(route.request().method()).toBe('POST')
        expect(route.request().postDataJSON()).toMatchObject(credentials)

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                id: 'user-1',
                username: credentials.username,
                email: credentials.email,
                full_name: null,
                avatar_url: null,
                is_superuser: false,
            }),
        })
    })

    await page.goto('/register')

    await page.getByLabel('Username').fill(credentials.username)
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByPlaceholder('Create a password').fill(credentials.password)
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL('/login')
    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
})

test('shows weak-password validation when registering', async ({ page }) => {
    await signedOutSession(page)

    let createUserCalled = false
    await page.route('**/api/v1/users', async (route) => {
        createUserCalled = true
        await route.abort()
    })

    await page.goto('/register')

    await page.getByLabel('Username').fill(credentials.username)
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByPlaceholder('Create a password').fill('weak')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(
        page.getByText('Password must be at least 8 characters.'),
    ).toBeVisible()
    expect(createUserCalled).toBe(false)
})
