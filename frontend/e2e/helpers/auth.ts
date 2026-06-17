import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const authFile = 'e2e/.auth/user.json'

export interface TestCredentials {
    username: string
    email: string
    password: string
}

export function buildUniqueCredentials(prefix: string): TestCredentials {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    return {
        username: `${prefix}-${suffix}`,
        email: `${prefix}-${suffix}@example.com`,
        password: 'StridePass123!',
    }
}

export async function registerUser(
    request: APIRequestContext,
    credentials: TestCredentials,
) {
    const response = await request.post('/api/v1/users', {
        data: {
            username: credentials.username,
            email: credentials.email,
            password: credentials.password,
        },
    })

    expect(response.ok()).toBeTruthy()
    return response
}

export async function loginThroughUi(
    page: Page,
    credentials: TestCredentials,
) {
    await page.goto('/login')
    await page.getByLabel('Email').fill(credentials.email)
    await page.getByPlaceholder('Enter your password').fill(
        credentials.password,
    )
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/')
}
