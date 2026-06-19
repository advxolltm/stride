import { expect, test } from '@playwright/test'
import { buildUniqueCredentials, registerUser } from './helpers/auth'

test('opens the login page for signed-out users', async ({ page }) => {
    await page.goto('/login')

    await expect(
        page.getByRole('heading', { name: 'Welcome back' }),
    ).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Sign in' }),
    ).toBeVisible()
})

test('signs in with valid credentials', async ({ page, request }) => {
    const credentials = buildUniqueCredentials('login')
    await registerUser(request, credentials)

    await page.goto('/login')

    await page.getByLabel('Email').fill(credentials.email)
    await page.getByPlaceholder('Enter your password').fill(
        credentials.password,
    )
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page).toHaveURL('/')
    await expect(
        page.getByRole('heading', { name: 'Projects', exact: true }),
    ).toBeVisible()
})
