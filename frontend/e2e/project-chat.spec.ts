import { expect, type Page, test } from '@playwright/test'
import { authFile, buildUniqueCredentials, createAuthenticatedPage, e2eBaseUrl, registerUser, type TestCredentials } from './helpers/auth'
import {
    addMembersFromProjectSpace,
    createProjectFromSidebar,
    openProjectFromActiveSidebar,
} from './helpers/project'

// ---------------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------------

async function sendMessage(page: Page, text: string) {
    await page.getByPlaceholder('Write Message...').fill(text)
    await page.getByPlaceholder('Write Message...').press('Enter')
}

async function openMessageMenu(page: Page, messageText: string) {
    // Walk up to the .group wrapper that contains both the bubble and the menu
    // button, then scope the click to that container so multiple messages in
    // the chat don't cause a strict-mode violation.
    const messageGroup = page
        .getByText(messageText, { exact: true })
        .locator('xpath=ancestor::div[contains(@class,"group")][1]')
    await messageGroup.hover()
    await messageGroup.getByRole('button', { name: 'Message actions' }).click()
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

/**
 * Uses test.describe.serial so beforeAll runs once and all tests share the
 * same project + member without re-creating them.
 */
test.describe.serial('Project Chat', () => {
    let projectId: string
    let member: TestCredentials
    let memberId: string

    // Unique per test-run so messages don't bleed across runs.
    let ownerMessage: string
    let memberMessage: string
    let memberEditedMessage: string
    let deletedUserMessage: string
    let editedMessage: string
    let notificationMessage: string

    test.beforeAll(async ({ browser, request }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

        ownerMessage = `Hello from owner ${suffix}`
        memberMessage = `Hello back from member ${suffix}`
        memberEditedMessage = `Edited by member ${suffix}`
        deletedUserMessage = `Message from deleted user ${suffix}`
        editedMessage = `Edited: Hello from owner ${suffix}`
        notificationMessage = `Ping ${suffix}`

        member = buildUniqueCredentials('chat-member')
        const memberResponse = await registerUser(request, member)
        const memberJson = await memberResponse.json()
        memberId = memberJson.id as string

        const context = await browser.newContext({
            baseURL: e2eBaseUrl,
            storageState: authFile,
        })
        const setupPage = await context.newPage()

        await createProjectFromSidebar(setupPage, {
            title: `Chat ${suffix}`,
            description: `Chat test project ${suffix}`,
        })
        await openProjectFromActiveSidebar(setupPage, `Chat ${suffix}`)

        const match = setupPage.url().match(/\/project\/([^/]+)/)
        projectId = match?.[1] ?? ''

        await addMembersFromProjectSpace(setupPage, [member.email])
        await context.close()
    })

    // -------------------------------------------------------------------------
    // Sending messages
    // -------------------------------------------------------------------------

    test('owner can send a message and it appears in the chat', async ({
        page,
    }) => {
        await page.goto(`/project/${projectId}/chat`)
        await sendMessage(page, ownerMessage)

        await expect(page.getByText(ownerMessage, { exact: true })).toBeVisible()
    })

    test('member sees the owner message in the chat', async ({ browser }) => {
        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto(`/project/${projectId}/chat`)

            await expect(
                memberPage.getByText(ownerMessage, { exact: true }),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('member cannot edit or delete the owner message', async ({
        browser,
    }) => {
        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto(`/project/${projectId}/chat`)
            await openMessageMenu(memberPage, ownerMessage)

            await expect(
                memberPage.getByRole('menuitem', { name: 'Copy message' }),
            ).toBeVisible()
            await expect(
                memberPage.getByRole('menuitem', { name: 'Edit' }),
            ).toHaveCount(0)
            await expect(
                memberPage.getByRole('menuitem', { name: 'Delete' }),
            ).toHaveCount(0)
        } finally {
            await context.close()
        }
    })

    test('member can send a reply and the owner sees it', async ({
        page,
        browser,
    }) => {
        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto(`/project/${projectId}/chat`)
            await sendMessage(memberPage, memberMessage)

            await expect(
                memberPage.getByText(memberMessage, { exact: true }),
            ).toBeVisible()
        } finally {
            await context.close()
        }

        await page.goto(`/project/${projectId}/chat`)
        await expect(page.getByText(memberMessage, { exact: true })).toBeVisible()
    })

    test('member can edit their own message and the owner sees the change without refreshing', async ({
        page,
        browser,
    }) => {
        await page.goto(`/project/${projectId}/chat`)

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto(`/project/${projectId}/chat`)
            await openMessageMenu(memberPage, memberMessage)
            await memberPage.getByRole('menuitem', { name: 'Edit' }).click()

            await memberPage.locator('textarea').fill(memberEditedMessage)
            await memberPage.locator('textarea').press('Control+Enter')

            await expect(
                memberPage.getByText(memberEditedMessage, { exact: true }),
            ).toBeVisible()
            await expect(
                memberPage.getByText('Edited', { exact: true }),
            ).toBeVisible()
        } finally {
            await context.close()
        }

        await expect(
            page.getByText(memberEditedMessage, { exact: true }),
        ).toBeVisible({ timeout: 10_000 })
    })

    test('member can delete their own message and the owner sees it removed without refreshing', async ({
        page,
        browser,
    }) => {
        await page.goto(`/project/${projectId}/chat`)

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto(`/project/${projectId}/chat`)
            await openMessageMenu(memberPage, memberEditedMessage)
            await memberPage.getByRole('menuitem', { name: 'Delete' }).click()
            await memberPage
                .getByRole('dialog')
                .getByRole('button', { name: 'Delete' })
                .click()

            await expect(
                memberPage.getByText(memberEditedMessage, { exact: true }),
            ).toHaveCount(0)
        } finally {
            await context.close()
        }

        await expect(
            page.getByText(memberEditedMessage, { exact: true }),
        ).toHaveCount(0, { timeout: 10_000 })
    })

    // -------------------------------------------------------------------------
    // Edit and delete (owner actions on their own messages)
    // -------------------------------------------------------------------------

    test('owner can edit their own message', async ({ page }) => {
        await page.goto(`/project/${projectId}/chat`)
        await openMessageMenu(page, ownerMessage)
        await page.getByRole('menuitem', { name: 'Edit' }).click()

        await page.locator('textarea').fill(editedMessage)
        await page.locator('textarea').press('Control+Enter')

        await expect(page.getByText(editedMessage, { exact: true })).toBeVisible()

        // The 'Edited' label is a tooltip trigger — hover it and verify the
        // tooltip shows the edit timestamp in the format "Edited: <date/time>".
        const editedLabel = page.getByText('Edited', { exact: true })
        await expect(editedLabel).toBeVisible()
        await editedLabel.hover()
        await expect(page.getByRole('tooltip')).toContainText(/^Edited: .+/)
    })

    test('owner can delete their own message', async ({ page }) => {
        await page.goto(`/project/${projectId}/chat`)
        await openMessageMenu(page, editedMessage)
        await page.getByRole('menuitem', { name: 'Delete' }).click()

        // Confirm in the dialog
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Delete' })
            .click()

        await expect(
            page.getByText(editedMessage, { exact: true }),
        ).toHaveCount(0)
    })

    // -------------------------------------------------------------------------
    // Notifications
    // -------------------------------------------------------------------------

    test('member receives a chat notification when the owner sends a message', async ({
        page,
        browser,
    }) => {
        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            // Member stays on the home page (not the chat).
            await memberPage.goto('/')

            // Owner sends a message.
            await page.goto(`/project/${projectId}/chat`)
            await sendMessage(page, notificationMessage)

            // Member's notification bell should show a badge.
            // Use getByLabel to target only the <button aria-label="Notifications">
            // and not the HeroUI Popover trigger div that also gets role="button".
            const notifBell = memberPage.getByLabel('Notifications')
            await expect(notifBell.locator('span')).toBeVisible({
                timeout: 10000,
            })

            // Opening the panel shows a notification whose message contains
            // the exact text the owner sent — unique per run, so this is more
            // precise than checking the generic 'Chat' type label which would
            // match every other chat notification in the panel.
            await notifBell.click()
            await expect(
                memberPage.getByText(notificationMessage),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('member can open the chat directly from a notification', async ({
        page,
        browser,
    }) => {
        const openFromNotificationMessage = `${notificationMessage} open`

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto('/')

            await page.goto(`/project/${projectId}/chat`)
            await sendMessage(page, openFromNotificationMessage)

            const notifBell = memberPage.getByLabel('Notifications')
            await expect(notifBell.locator('span')).toBeVisible({
                timeout: 10_000,
            })

            await notifBell.click()
            await memberPage.getByText(openFromNotificationMessage).click()

            await expect(memberPage).toHaveURL(`/project/${projectId}/chat`)
            await expect(
                memberPage.getByText(openFromNotificationMessage, {
                    exact: true,
                }),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('owner still sees a message when its sender account was deleted', async ({
        page,
        browser,
    }) => {
        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )
        try {
            await memberPage.goto(`/project/${projectId}/chat`)
            await sendMessage(memberPage, deletedUserMessage)
            await expect(
                memberPage.getByText(deletedUserMessage, { exact: true }),
            ).toBeVisible()

            const deleteResponse = await memberPage.evaluate(
                async ({ userId }) => {
                    const response = await fetch(`/api/v1/users/${userId}`, {
                        method: 'DELETE',
                        credentials: 'include',
                    })

                    return {
                        ok: response.ok,
                        status: response.status,
                    }
                },
                { userId: memberId },
            )

            expect(deleteResponse.ok).toBeTruthy()
            expect(deleteResponse.status).toBe(204)
        } finally {
            await context.close()
        }

        await page.goto(`/project/${projectId}/chat`)
        await expect(
            page.getByText('user deleted', { exact: true }),
        ).toBeVisible()
        await expect(
            page.getByText(deletedUserMessage, { exact: true }),
        ).toBeVisible()
    })
})
