import { mkdirSync } from 'node:fs'
import { test as setup } from '@playwright/test'
import { authFile, buildUniqueCredentials, loginThroughUi, registerUser } from './helpers/auth'

setup('authenticate project test user', async ({ page, request }) => {
    mkdirSync('e2e/.auth', { recursive: true })

    const credentials = buildUniqueCredentials('project-owner')
    await registerUser(request, credentials)
    await loginThroughUi(page, credentials)

    await page.context().storageState({ path: authFile })
})
