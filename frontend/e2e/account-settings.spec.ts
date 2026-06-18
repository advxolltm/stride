import { expect, test } from '@playwright/test'
import {
    authFile,
    buildUniqueCredentials,
    createAuthenticatedPage,
    loginThroughUi,
    registerUser,
    type TestCredentials,
} from './helpers/auth'
import {
    addMembersFromProjectSpace,
    createProjectFromSidebar,
    getProjectSettingsDialog,
    openProjectFromActiveSidebar,
    openProjectSettings,
    openProjectSettingsTab,
} from './helpers/project'

async function openSettingsFromUserMenu(page: Parameters<typeof test>[0]['page']) {
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.getByRole('menuitem', { name: 'Profile' }).click()
    await expect(page).toHaveURL(/\/settings\/profile$/)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
}

test.describe.serial('Account Settings', () => {
    let emptyUser: TestCredentials
    let projectUser: TestCredentials
    let projectUserPassword: string
    let projectTitle: string
    let projectSkillName: string

    test.beforeAll(async ({ browser, request }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        emptyUser = buildUniqueCredentials('empty-account')
        projectUser = buildUniqueCredentials('project-account')
        projectUserPassword = projectUser.password
        projectTitle = `Account Project ${suffix}`
        projectSkillName = `Account Skill ${suffix}`

        await registerUser(request, emptyUser)
        await registerUser(request, projectUser)

        const ownerContext = await browser.newContext({
            baseURL: 'http://localhost:8080',
            storageState: authFile,
        })
        const ownerPage = await ownerContext.newPage()

        await createProjectFromSidebar(ownerPage, {
            title: projectTitle,
            description: `Account settings project ${suffix}`,
        })
        await openProjectFromActiveSidebar(ownerPage, projectTitle)
        await addMembersFromProjectSpace(ownerPage, [projectUser.email])

        await openProjectSettings(ownerPage)
        await openProjectSettingsTab(ownerPage, 'Skills')
        const settingsDialog = getProjectSettingsDialog(ownerPage)
        await settingsDialog.getByRole('button', { name: 'Add Skill' }).click()
        await settingsDialog.getByRole('tab', { name: 'Custom' }).click()
        await settingsDialog.getByLabel('Name').fill(projectSkillName)
        await settingsDialog.getByRole('button', { name: 'Save skill' }).click()
        await expect(
            ownerPage.getByText('Skill added successfully'),
        ).toBeVisible()

        await ownerContext.close()
    })

    test('opens account settings from the user menu and updates the profile full name', async ({
        browser,
    }) => {
        const updatedFullName = `Project User ${Date.now()}`
        const { context, page } = await createAuthenticatedPage(browser, projectUser)

        try {
            await page.goto('/')
            await openSettingsFromUserMenu(page)

            await page.getByLabel('Full name').fill(updatedFullName)
            await page.getByRole('button', { name: 'Save changes' }).click()

            await expect(
                page.getByText('Profile updated successfully'),
            ).toBeVisible()

            await page.goto('/')
            await expect(page.getByRole('button', { name: 'Menu' })).toContainText(
                updatedFullName,
            )
        } finally {
            await context.close()
        }
    })

    test('changes the password and allows signing in with the new password', async ({
        browser,
    }) => {
        const newPassword = `StridePass456!`
        const { context, page } = await createAuthenticatedPage(browser, {
            ...projectUser,
            password: projectUserPassword,
        })

        try {
            await page.goto('/settings/security')
            await page
                .getByPlaceholder('Enter current password')
                .fill(projectUserPassword)
            await page.getByPlaceholder('Enter new password').fill(newPassword)
            await page.getByPlaceholder('Confirm new password').fill(newPassword)
            await page.getByRole('button', { name: 'Update password' }).click()

            await expect(
                page.getByText('Password updated successfully'),
            ).toBeVisible()
        } finally {
            await context.close()
        }

        projectUserPassword = newPassword

        const loginContext = await browser.newContext({
            baseURL: 'http://localhost:8080',
            storageState: { cookies: [], origins: [] },
        })
        const loginPage = await loginContext.newPage()

        try {
            await loginThroughUi(loginPage, {
                ...projectUser,
                password: projectUserPassword,
            })
            await expect(loginPage).toHaveURL('/')
        } finally {
            await loginContext.close()
        }
    })

    test('shows empty states for skills and working hours when the user has no projects', async ({
        browser,
    }) => {
        const { context, page } = await createAuthenticatedPage(browser, emptyUser)

        try {
            await page.goto('/settings/skills')
            await expect(
                page.getByText('You are not a member of any projects yet.', {
                    exact: true,
                }),
            ).toBeVisible()

            await page.goto('/settings/working-hours')
            await expect(
                page.getByText('You are not a member of any projects yet.', {
                    exact: true,
                }),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('updates project skills for a project-backed account', async ({
        browser,
    }) => {
        const { context, page } = await createAuthenticatedPage(browser, {
            ...projectUser,
            password: projectUserPassword,
        })

        try {
            await page.goto('/settings/skills')
            await expect(
                page.getByRole('heading', { name: projectTitle }),
            ).toBeVisible()

            const projectCard = page
                .getByRole('heading', { name: projectTitle })
                .locator('xpath=ancestor::div[contains(@class, "rounded-xl")][1]')

            const saveButton = page.getByRole('button', { name: 'Save changes' })
            const removeTagButton = projectCard.getByRole('button', {
                name: new RegExp(`Remove tag ${projectSkillName}`),
            })

            if (await removeTagButton.count()) {
                await removeTagButton.click()
                await saveButton.click()
                await expect(
                    page.getByText('Skills updated successfully'),
                ).toBeVisible()
                await expect(
                    page.getByText('0 / 1 selected', { exact: true }),
                ).toBeVisible()
            }

            await projectCard.locator('[data-placeholder="true"]').click()
            await page.getByRole('option', { name: projectSkillName }).click()
            await page.keyboard.press('Escape')
            await saveButton.click()

            await expect(
                page.getByText('Skills updated successfully'),
            ).toBeVisible()
            await expect(
                page.getByText('1 / 1 selected', { exact: true }),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('updates working hours for a project-backed account', async ({
        browser,
    }) => {
        const { context, page } = await createAuthenticatedPage(browser, {
            ...projectUser,
            password: projectUserPassword,
        })

        try {
            await page.goto('/settings/working-hours')
            const hoursInput = page.getByLabel(`Weekly hours for ${projectTitle}`)
            await hoursInput.fill('12')
            await hoursInput.blur()
            await page.getByRole('button', { name: 'Save changes' }).click()

            await expect(
                page.getByText('Working hours updated successfully'),
            ).toBeVisible()
            await expect(hoursInput).toHaveValue('12')
            await expect(page.getByText(/12\/40h/)).toBeVisible()
            await expect(page.getByText(/28h/)).toBeVisible()
        } finally {
            await context.close()
        }
    })
})
