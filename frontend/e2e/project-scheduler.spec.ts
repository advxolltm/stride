import {
    expect,
    type APIRequestContext,
    type Browser,
    type Page,
    test,
} from '@playwright/test'
import {
    buildUniqueCredentials,
    createAuthenticatedPage,
    registerUser,
} from './helpers/auth'
import {
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

async function createFreshOwnerPage(
    browser: Browser,
    request: APIRequestContext,
    prefix: string,
) {
    const owner = buildUniqueCredentials(prefix)
    await registerUser(request, owner)
    return createAuthenticatedPage(browser, owner)
}

async function createProjectForScheduler(page: Page, suffix: string) {
    const project = {
        title: `Scheduler Alpha ${suffix}`,
        description: `Scheduler coverage project ${suffix}`,
    }

    await createProjectFromSidebar(page, project)
    await openProjectFromActiveSidebar(page, project.title)

    const match = page.url().match(/\/project\/([^/]+)/)
    const projectId = match?.[1] ?? ''

    return { project, projectId }
}

async function addTaskInTodoColumn(page: Page, taskTitle: string) {
    await page.getByRole('button', { name: 'Add Task' }).first().click()
    await page.getByLabel('Task name').fill(taskTitle)
    await page.getByRole('button', { name: 'Create Task' }).click()
    await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()
}

async function openTaskDrawer(page: Page, taskTitle: string) {
    await page.getByText(taskTitle, { exact: true }).first().click()
    await expect(
        page.getByRole('heading', { name: 'Task Details' }),
    ).toBeVisible()
}

async function closeTaskDrawer(page: Page) {
    const taskDrawer = page.getByRole('dialog', { name: 'Task Details' })
    await taskDrawer.getByRole('button', { name: 'Close' }).click()
    await expect(taskDrawer).toHaveCount(0)
}

async function setTaskEstimatedHours(page: Page, hours: number) {
    await page
        .getByRole('button', { name: 'Edit Estimated Time (hours)' })
        .click()
    const estimatedHoursInput = page.getByRole('spinbutton', {
        name: 'Estimated Time (hours)',
    })
    await estimatedHoursInput.fill(String(hours))
    await estimatedHoursInput.press('Enter')
    await expect(page.getByText('Task updated.').first()).toBeVisible()
}

async function setTaskStartDateToToday(page: Page) {
    await page.locator('button').filter({ hasText: 'No start date' }).click()
    const startDateCalendar = page.getByRole('application', {
        name: 'Start Date',
    })
    await expect(startDateCalendar).toBeVisible()
    await startDateCalendar.locator('[data-today="true"]').click()
    await expect(page.getByText('Task updated.').first()).toBeVisible()
}

async function setTaskDueDateToToday(page: Page) {
    await page.locator('button').filter({ hasText: 'No due date' }).click()
    const dueDateCalendar = page.getByRole('application', { name: 'Due Date' })
    await expect(dueDateCalendar).toBeVisible()
    await dueDateCalendar.locator('[data-today="true"]').click()
    await expect(page.getByText('Task updated.').first()).toBeVisible()
}

async function setOwnerWorkingHours(
    page: Page,
    projectTitle: string,
    hours: number,
) {
    await page.goto('/')
    await openProjectFromActiveSidebar(page, projectTitle)
    await openProjectSettings(page)
    await openProjectSettingsTab(page, 'My Working Hours')

    const settingsDialog = getProjectSettingsDialog(page)
    await settingsDialog.getByRole('button', { name: 'Edit' }).click()
    await settingsDialog
        .getByLabel(`Weekly hours on ${projectTitle}`)
        .fill(String(hours))
    await settingsDialog.getByRole('button', { name: 'Save changes' }).click()

    await expect(
        page.getByText('Working hours updated successfully'),
    ).toBeVisible({ timeout: 15000 })

    await settingsDialog.getByRole('button', { name: 'Close' }).click()
}

async function openScheduler(page: Page) {
    await page.getByRole('button', { name: 'Assign Tasks' }).click()
    await expect(
        page.getByRole('heading', { name: 'Auto-assign tasks?' }),
    ).toBeVisible()
}

test.describe('Project Scheduler', () => {
    test('shows scheduler validations as project data becomes schedulable', async ({
        browser,
        request,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const taskTitle = `Scheduler Task ${suffix}`
        const { context, page } = await createFreshOwnerPage(
            browser,
            request,
            'scheduler-owner-validation',
        )

        try {
            const { project, projectId } = await createProjectForScheduler(
                page,
                suffix,
            )

            await navigateToTasks(page, projectId)
            await openScheduler(page)

            await expect(
                page.getByText(
                    'Add at least one open task before running the scheduler.',
                ),
            ).toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Run scheduler' }),
            ).toBeDisabled()

            await page.getByRole('button', { name: 'Cancel' }).click()
            await addTaskInTodoColumn(page, taskTitle)

            await openScheduler(page)
            await expect(
                page.getByText(
                    'Add working hours for at least one team member before running the scheduler.',
                ),
            ).toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Run scheduler' }),
            ).toBeDisabled()

            await page.getByRole('button', { name: 'Cancel' }).click()
            await setOwnerWorkingHours(page, project.title, 12)

            await navigateToTasks(page, projectId)
            await openScheduler(page)
            await expect(
                page.getByText(
                    'Add an estimated time to at least one open task before running the scheduler.',
                ),
            ).toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Run scheduler' }),
            ).toBeDisabled()

            await page.getByRole('button', { name: 'Cancel' }).click()
            await openTaskDrawer(page, taskTitle)
            await setTaskEstimatedHours(page, 4)
            await closeTaskDrawer(page)

            await openScheduler(page)
            await expect(
                page.getByText(
                    'Add a start date to at least one open task before running the scheduler.',
                ),
            ).toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Run scheduler' }),
            ).toBeDisabled()

            await page.getByRole('button', { name: 'Cancel' }).click()
            await openTaskDrawer(page, taskTitle)
            await setTaskStartDateToToday(page)
            await closeTaskDrawer(page)

            await openScheduler(page)
            await expect(
                page.getByText(
                    "You'll be able to review and adjust before confirming.",
                ),
            ).toBeVisible()
            await expect(
                page.getByRole('button', { name: 'Run scheduler' }),
            ).toBeEnabled()
        } finally {
            await context.close().catch(() => {})
        }
    })

    test('runs the scheduler, reviews grouped assignments, and confirms them', async ({
        browser,
        request,
    }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const taskTitle = `Scheduler Confirm ${suffix}`
        const { context, page } = await createFreshOwnerPage(
            browser,
            request,
            'scheduler-owner-confirm',
        )

        try {
            const { project, projectId } = await createProjectForScheduler(
                page,
                suffix,
            )

            await setOwnerWorkingHours(page, project.title, 14)
            await navigateToTasks(page, projectId)
            await addTaskInTodoColumn(page, taskTitle)
            await openTaskDrawer(page, taskTitle)
            await setTaskEstimatedHours(page, 5)
            await setTaskStartDateToToday(page)
            await setTaskDueDateToToday(page)
            await closeTaskDrawer(page)

            await openScheduler(page)

            const previewResponsePromise = page.waitForResponse(
                (response) =>
                    response
                        .url()
                        .includes(`/api/v1/projects/${projectId}/scheduler`) &&
                    !response.url().includes('/confirm') &&
                    response.request().method() === 'POST',
            )

            await page.getByRole('button', { name: 'Run scheduler' }).click()
            await expect(
                page.getByRole('heading', { name: 'Assigning tasks' }),
            ).toBeVisible()

            const previewResponse = await previewResponsePromise
            expect(previewResponse.ok()).toBeTruthy()

            const schedulerDialog = page.getByRole('dialog')
            await expect(
                schedulerDialog.getByRole('heading', {
                    name: 'Review assignments',
                }),
            ).toBeVisible()
            await expect(
                schedulerDialog.getByText('New assignments (1)'),
            ).toBeVisible()
            await expect(
                schedulerDialog.getByText(taskTitle, { exact: true }),
            ).toBeVisible()
            await expect(
                schedulerDialog.getByText('Changed assignments (0)'),
            ).toBeVisible()
            await expect(
                schedulerDialog.getByText(
                    'No existing assignments needed to be changed.',
                ),
            ).toBeVisible()

            const confirmResponsePromise = page.waitForResponse(
                (response) =>
                    response.url().includes(
                        `/api/v1/projects/${projectId}/scheduler/confirm`,
                    ) && response.request().method() === 'POST',
            )

            await page
                .getByRole('button', { name: 'Confirm assignments' })
                .click()

            const confirmResponse = await confirmResponsePromise
            expect(confirmResponse.ok()).toBeTruthy()

            await expect(
                page.getByText('Scheduler assignments saved.'),
            ).toBeVisible()
            await expect(
                page.getByRole('heading', { name: 'Auto-assign tasks?' }),
            ).toHaveCount(0)

            await openTaskDrawer(page, taskTitle)
            await expect(
                page.getByRole('dialog', { name: 'Task Details' }).getByText(
                    'No assignee',
                    { exact: true },
                ),
            ).toHaveCount(0)
        } finally {
            await context.close().catch(() => {})
        }
    })
})
