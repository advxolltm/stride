import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { test as setup } from '@playwright/test'
import {
    authFile,
    buildUniqueCredentials,
    e2eBaseUrl,
    loginThroughApi,
    registerUser,
} from './helpers/auth'

setup('authenticate project test user', async ({ request }) => {
    mkdirSync('e2e/.auth', { recursive: true })

    const credentials = buildUniqueCredentials('project-owner')
    await registerUser(request, credentials)
    await loginThroughApi(request, credentials)
    await request.storageState({ path: authFile })

    const storageState = JSON.parse(readFileSync(authFile, 'utf8')) as {
        cookies: unknown[]
        origins?: Array<{
            origin: string
            localStorage?: Array<{ name: string; value: string }>
        }>
    }
    const appOrigin = e2eBaseUrl
    const originState = storageState.origins?.find(
        (origin) => origin.origin === appOrigin,
    )

    const localStorage = [
        { name: 'i18nextLng', value: 'en' },
        { name: 'theme', value: 'light' },
        { name: 'lang', value: 'en' },
    ]

    if (originState) {
        originState.localStorage = localStorage
    } else {
        storageState.origins = [
            ...(storageState.origins ?? []),
            {
                origin: appOrigin,
                localStorage,
            },
        ]
    }

    writeFileSync(authFile, JSON.stringify(storageState, null, 2))
})
