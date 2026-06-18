import { expect, type Page, test } from '@playwright/test'
import {
    authFile,
    buildUniqueCredentials,
    createAuthenticatedPage,
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

async function navigateToTasks(page: Page, projectId: string) {
    await page.goto(`/project/${projectId}/tasks`)
    await expect(page.getByText('To Do', { exact: true })).toBeVisible()
}

async function addTaskInColumn(
    page: Page,
    columnIndex: 0 | 1 | 2,
    taskName: string,
) {
    await page.getByRole('button', { name: 'Add Task' }).nth(columnIndex).click()
    const taskNameInput = page.getByLabel('Task name')
    await taskNameInput.fill(taskName)
    await taskNameInput.press('Enter')
    await expect(page.getByText(taskName, { exact: true })).toBeVisible()
}

async function openTaskDrawer(page: Page, taskTitle: string) {
    await page.getByText(taskTitle, { exact: true }).first().click()
    await expect(
        page.getByRole('heading', { name: 'Task Details' }),
    ).toBeVisible()
}

async function assignTaskToMember(
    page: Page,
    taskTitle: string,
    member: TestCredentials,
) {
    await openTaskDrawer(page, taskTitle)
    await page.getByText('No assignee', { exact: true }).click()
    await page.getByPlaceholder('Search users...').fill(member.username)
    await page
        .getByRole('option', { name: new RegExp(member.username) })
        .click()
    await expect(page.getByText('Task updated.').first()).toBeVisible()
    await page.getByRole('dialog', { name: 'Task Details' }).getByLabel('Close', {
        exact: true,
    }).click()
}

async function unassignTaskFromMember(
    page: Page,
    taskTitle: string,
    member: TestCredentials,
) {
    await openTaskDrawer(page, taskTitle)

    const drawer = page.getByRole('dialog', { name: 'Task Details' })
    await drawer.evaluate((dialog, username) => {
        const groups = Array.from(dialog.querySelectorAll('[role="group"]'))
        const assigneeGroup = groups.find((group) =>
            group.textContent?.includes(username as string),
        )
        if (!assigneeGroup) {
            throw new Error('Assignee group not found')
        }

        const clearButton = assigneeGroup.querySelector('button')
        if (!(clearButton instanceof HTMLButtonElement)) {
            throw new Error('Assignee clear button not found')
        }

        clearButton.click()
    }, member.username)

    await expect(page.getByText('Task updated.').first()).toBeVisible()
}

async function openTaskMenu(page: Page, taskTitle: string) {
    await page
        .getByText(taskTitle, { exact: true })
        .locator('..')
        .getByRole('button', { name: 'Task actions' })
        .click()
}

async function openNotifications(page: Page) {
    await page.getByLabel('Notifications').click()
    await expect(page.getByText('Notifications', { exact: true })).toBeVisible()
}

test.describe.serial('Project Notifications', () => {
    let projectId: string
    let projectTitle: string
    let member: TestCredentials

    test.beforeAll(async ({ browser, request }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        projectTitle = `Notifications ${suffix}`
        member = buildUniqueCredentials('notify-member')
        await registerUser(request, member)

        const context = await browser.newContext({
            baseURL: 'http://localhost:8080',
            storageState: authFile,
        })
        const page = await context.newPage()

        await createProjectFromSidebar(page, {
            title: projectTitle,
            description: `Notification project ${suffix}`,
        })
        await openProjectFromActiveSidebar(page, projectTitle)

        const match = page.url().match(/\/project\/([^/]+)/)
        projectId = match?.[1] ?? ''

        await addMembersFromProjectSpace(page, [member.email])
        await context.close()
    })

    test('member can open an assignment notification from the center and it becomes read', async ({
        page,
        browser,
    }) => {
        const taskTitle = `Notify Assign ${Date.now()}`
        const notificationMessage = `You were assigned to task: ${taskTitle}`

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )

        try {
            await memberPage.goto('/')

            await navigateToTasks(page, projectId)
            await addTaskInColumn(page, 0, taskTitle)
            await assignTaskToMember(page, taskTitle, member)

            await openNotifications(memberPage)
            await expect(
                memberPage.getByText(notificationMessage, { exact: true }),
            ).toBeVisible()

            await memberPage.getByText(notificationMessage, { exact: true }).click()

            await expect(memberPage).toHaveURL(
                new RegExp(`/project/${projectId}/tasks`),
            )
            await expect(
                memberPage.getByRole('heading', { name: 'Task Details' }),
            ).toBeVisible()
            await expect(
                memberPage.getByText(taskTitle, { exact: true }).first(),
            ).toBeVisible()

            await memberPage
                .getByRole('dialog', { name: 'Task Details' })
                .getByLabel('Close', { exact: true })
                .click()
            await openNotifications(memberPage)
            await expect(
                memberPage.getByText('0 unread', { exact: true }),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('member can delete a notification from the center', async ({
        page,
        browser,
    }) => {
        const taskTitle = `Notify Delete Row ${Date.now()}`
        const notificationMessage = `You were assigned to task: ${taskTitle}`

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )

        try {
            await memberPage.goto('/')

            await navigateToTasks(page, projectId)
            await addTaskInColumn(page, 0, taskTitle)
            await assignTaskToMember(page, taskTitle, member)

            await openNotifications(memberPage)
            const notificationRow = memberPage
                .getByText(notificationMessage, { exact: true })
                .locator('xpath=ancestor::div[contains(@class, "border-b")][1]')

            await expect(notificationRow).toBeVisible()
            await notificationRow
                .getByRole('button', { name: 'Delete notification' })
                .click()

            await expect(
                memberPage.getByText(notificationMessage, { exact: true }),
            ).toHaveCount(0)
        } finally {
            await context.close()
        }
    })

    test('member can open a task-deleted notification to navigate to the task board', async ({
        page,
        browser,
    }) => {
        const taskTitle = `Notify Task Deleted ${Date.now()}`
        const notificationMessage = `Task deleted: ${taskTitle}`

        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )

        try {
            await memberPage.goto('/')

            await navigateToTasks(page, projectId)
            await addTaskInColumn(page, 0, taskTitle)
            await assignTaskToMember(page, taskTitle, member)
            await openTaskMenu(page, taskTitle)
            await page.getByRole('menuitem', { name: 'Delete task' }).click()
            await page
                .getByRole('dialog')
                .getByRole('button', { name: 'Delete task' })
                .click()

            await openNotifications(memberPage)
            await expect(
                memberPage.getByText(notificationMessage, { exact: true }),
            ).toBeVisible()

            await memberPage.getByText(notificationMessage, { exact: true }).click()

            await expect(memberPage).toHaveURL(
                new RegExp(`/project/${projectId}/tasks\\?view=kanban`),
            )
            await expect(
                memberPage.getByText('To Do', { exact: true }),
            ).toBeVisible()
        } finally {
            await context.close()
        }
    })

    test('member sees project archive and unarchive notifications', async ({
        page,
        browser,
    }) => {
        const { context, page: memberPage } = await createAuthenticatedPage(
            browser,
            member,
        )

        try {
            await memberPage.goto(`/project/${projectId}`)

            await page.goto(`/project/${projectId}`)
            await openProjectSettings(page)
            await openProjectSettingsTab(page, 'General')

            const settingsDialog = getProjectSettingsDialog(page)
            await settingsDialog.getByRole('button', { name: 'Archive' }).click()
            await page.getByRole('button', { name: 'Archive Project' }).click()

            await expect(
                memberPage.getByRole('dialog').getByText('Project Archived'),
            ).toBeVisible()
            await expect(
                memberPage.getByText(`Project ${projectTitle} was archived.`),
            ).toBeVisible()
            await memberPage.getByRole('button', { name: 'OK' }).click()

            await openProjectSettingsTab(page, 'General')
            await settingsDialog.getByRole('button', { name: 'Unarchive' }).click()
            await page.getByRole('button', { name: 'Unarchive Project' }).click()

            await expect(
                memberPage.getByRole('dialog').getByText('Project Unarchived'),
            ).toBeVisible()
            await expect(
                memberPage.getByText(`Project ${projectTitle} was unarchived.`),
            ).toBeVisible()
            await memberPage.getByRole('button', { name: 'OK' }).click()
        } finally {
            await context.close()
        }
    })
})
