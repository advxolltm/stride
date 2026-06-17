import { expect, test } from '@playwright/test'
import { buildUniqueCredentials } from './helpers/auth'

test('creates an account with valid registration data', async ({ page }) => {
    const credentials = buildUniqueCredentials('register')

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
    const credentials = buildUniqueCredentials('weak-password')

    await page.goto('/register')

    await page.getByLabel('Username').fill(credentials.username)
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByPlaceholder('Create a password').fill('weak')
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(
        page.getByText('Password must be at least 8 characters.'),
    ).toBeVisible()
    await expect(page).toHaveURL('/register')
})
