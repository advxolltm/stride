import {
    expect,
    type APIRequestContext,
    type Browser,
    type BrowserContext,
    type Page,
} from '@playwright/test'

export const authFile = 'e2e/.auth/user.json'
export const e2eBaseUrl = 'http://127.0.0.1:8080'

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

export async function loginThroughApi(
    request: APIRequestContext,
    credentials: TestCredentials,
) {
    const response = await request.post('/api/v1/auth/login', {
        form: {
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

export async function createAuthenticatedPage(
    browser: Browser,
    credentials: TestCredentials,
): Promise<{ context: BrowserContext; page: Page }> {
    const context = await browser.newContext({
        baseURL: e2eBaseUrl,
        storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    await loginThroughUi(page, credentials)

    // Keep the language pinned to English so selectors in member-context tests
    // match the same strings as the owner context.
    await page.evaluate(() => localStorage.setItem('lang', 'en'))

    return { context, page }
}
