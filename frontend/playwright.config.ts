import { defineConfig, devices } from '@playwright/test'

const authFile = 'e2e/.auth/user.json'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [['html'], ['github']] : [['list'], ['html']],
    use: {
        baseURL: 'http://localhost:8080',
        // Pin the UI language to English so every selector matches English
        // strings regardless of the OS locale or any previously saved lang
        // preference.
        locale: 'en-US',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'setup',
            testMatch: /auth\.setup\.ts/,
        },
        {
            name: 'chromium-public',
            use: { ...devices['Desktop Chrome'] },
            testIgnore: [/auth\.setup\.ts/, /project-.*\.spec\.ts/],
        },
        {
            name: 'chromium-authenticated',
            dependencies: ['setup'],
            testMatch: /project-.*\.spec\.ts/,
            use: {
                ...devices['Desktop Chrome'],
                storageState: authFile,
            },
        },
    ],
})
