import { expect, test } from '@playwright/test'
import { authFile, buildUniqueCredentials, createAuthenticatedPage, registerUser, type TestCredentials } from './helpers/auth'
import {
    addMembersFromProjectSpace,
    createProjectFromSidebar,
    getProjectSettingsDialog,
    openProjectFromActiveSidebar,
    openProjectSettings,
    openProjectSettingsTab,
} from './helpers/project'

/**
 * Permissions suite for Project Settings.
 *
 * Uses test.describe.serial so the beforeAll setup (project creation +
 * member registration) runs once and all subsequent tests share that
 * project without re-creating it.
 */
test.describe.serial('Project Settings – Permissions', () => {
    let projectTitle: string
    let member: TestCredentials

    test.beforeAll(async ({ browser, request }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        projectTitle = `Perms ${suffix}`
        member = buildUniqueCredentials('perms-member')

        await registerUser(request, member)

        // Create project and add the member as owner.
        const context = await browser.newContext({
            baseURL: 'http://localhost:8080',
            storageState: authFile,
        })
        const setupPage = await context.newPage()

        await createProjectFromSidebar(setupPage, {
            title: projectTitle,
            description: `Permissions test project ${suffix}`,
        })
        await openProjectFromActiveSidebar(setupPage, projectTitle)
        await addMembersFromProjectSpace(setupPage, [member.email])

        await context.close()
    })

    // -------------------------------------------------------------------------
    // Project owner – should be able to edit every settings tab
    // -------------------------------------------------------------------------

    test.describe('project owner', () => {
        test.beforeEach(async ({ page }) => {
            await page.goto('/')
        })

        test('can edit general settings', async ({ page }) => {
            await openProjectFromActiveSidebar(page, projectTitle)
            await openProjectSettings(page)
            await openProjectSettingsTab(page, 'General')

            const dialog = getProjectSettingsDialog(page)
            await expect(
                dialog.getByRole('button', { name: 'Edit' }),
            ).toBeVisible()
            await expect(
                dialog.getByRole('button', { name: 'Archive' }),
            ).toBeVisible()
        })

        test('can manage team members', async ({ page }) => {
            await openProjectFromActiveSidebar(page, projectTitle)
            await openProjectSettings(page)
            await openProjectSettingsTab(page, 'Team')

            const dialog = getProjectSettingsDialog(page)
            await expect(
                dialog.getByRole('button', { name: 'Add members' }),
            ).toBeVisible()
        })

        test('can manage project skills', async ({ page }) => {
            await openProjectFromActiveSidebar(page, projectTitle)
            await openProjectSettings(page)
            await openProjectSettingsTab(page, 'Skills')

            const dialog = getProjectSettingsDialog(page)
            await expect(
                dialog.getByRole('button', { name: 'Add Skill' }),
            ).toBeVisible()
        })
    })

    // -------------------------------------------------------------------------
    // Non-owner member – settings should be read-only
    // -------------------------------------------------------------------------

    test.describe('non-owner member', () => {
        test('sees general settings as read-only', async ({ browser }) => {
            const { context, page: memberPage } = await createAuthenticatedPage(
                browser,
                member,
            )
            try {
                await openProjectFromActiveSidebar(memberPage, projectTitle)
                await openProjectSettings(memberPage)
                await openProjectSettingsTab(memberPage, 'General')

                const dialog = getProjectSettingsDialog(memberPage)
                await expect(
                    dialog.getByRole('button', { name: 'Edit' }),
                ).toHaveCount(0)
                await expect(
                    dialog.getByRole('button', { name: 'Archive' }),
                ).toHaveCount(0)
            } finally {
                await context.close()
            }
        })

        test('cannot manage team members', async ({ browser }) => {
            const { context, page: memberPage } = await createAuthenticatedPage(
                browser,
                member,
            )
            try {
                await openProjectFromActiveSidebar(memberPage, projectTitle)
                await openProjectSettings(memberPage)
                await openProjectSettingsTab(memberPage, 'Team')

                const dialog = getProjectSettingsDialog(memberPage)
                await expect(
                    dialog.getByRole('button', { name: 'Add members' }),
                ).toHaveCount(0)
                await expect(
                    dialog
                        .locator('button')
                        .filter({ has: dialog.locator('svg.lucide-trash2') }),
                ).toHaveCount(0)
            } finally {
                await context.close()
            }
        })

        test('cannot manage project skills', async ({ browser }) => {
            const { context, page: memberPage } = await createAuthenticatedPage(
                browser,
                member,
            )
            try {
                await openProjectFromActiveSidebar(memberPage, projectTitle)
                await openProjectSettings(memberPage)
                await openProjectSettingsTab(memberPage, 'Skills')

                const dialog = getProjectSettingsDialog(memberPage)
                await expect(
                    dialog.getByRole('button', { name: 'Add Skill' }),
                ).toHaveCount(0)
            } finally {
                await context.close()
            }
        })
    })
})
