import { mkdirSync } from 'node:fs'
import { test as setup } from '@playwright/test'
import { authFile, buildUniqueCredentials, loginThroughUi, registerUser } from './helpers/auth'

setup('authenticate project test user', async ({ page, request }) => {
    mkdirSync('e2e/.auth', { recursive: true })

    const credentials = buildUniqueCredentials('project-owner')
    await registerUser(request, credentials)
    await loginThroughUi(page, credentials)

    // Explicitly lock the app language to English so the saved auth state
    // always carries lang=en, regardless of who ran setup last.
    await page.evaluate(() => localStorage.setItem('lang', 'en'))

    await page.context().storageState({ path: authFile })
})
