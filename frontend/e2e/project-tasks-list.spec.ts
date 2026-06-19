import { expect, type Page, test } from '@playwright/test'
import { authFile, e2eBaseUrl } from './helpers/auth'
import {
    createProjectFromSidebar,
    openProjectFromActiveSidebar,
} from './helpers/project'

async function navigateToTasks(page: Page, projectId: string) {
    await page.goto(`/project/${projectId}/tasks`)
    await expect(page.getByText('To Do', { exact: true })).toBeVisible()
}

async function switchToListView(page: Page) {
    await page.getByRole('tab', { name: 'List' }).click()
    await expect(
        page.getByRole('button', { name: 'Columns' }),
    ).toBeVisible()
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

test.describe.serial('Project Tasks – List View', () => {
    let projectId: string
    let seedTaskTitle: string

    test.beforeAll(async ({ browser }) => {
        const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        seedTaskTitle = `List Seed ${suffix}`

        const context = await browser.newContext({
            baseURL: e2eBaseUrl,
            storageState: authFile,
        })
        const page = await context.newPage()

        await createProjectFromSidebar(page, {
            title: `List Tasks ${suffix}`,
            description: `List task test project ${suffix}`,
        })
        await openProjectFromActiveSidebar(page, `List Tasks ${suffix}`)

        const match = page.url().match(/\/project\/([^/]+)/)
        projectId = match?.[1] ?? ''

        await navigateToTasks(page, projectId)
        await addTaskInColumn(page, 0, seedTaskTitle)

        await context.close()
    })

    test('adds a task from list view and opens the edit drawer from a row', async ({
        page,
    }) => {
        const taskTitle = `List Add ${Date.now()}`

        await navigateToTasks(page, projectId)
        await switchToListView(page)

        await page.getByRole('button', { name: 'Add' }).click()
        await page.getByLabel('Task name').fill(taskTitle)
        await page.getByRole('button', { name: 'Create Task' }).click()

        await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()

        await page.getByRole('button', { name: taskTitle }).click()
        await expect(
            page.getByRole('heading', { name: 'Task Details' }),
        ).toBeVisible()
    })

    test('filters list rows and shows the empty state when no task matches', async ({
        page,
    }) => {
        const matchingTask = `List Search Alpha ${Date.now()}`
        const otherTask = `List Search Beta ${Date.now()}`

        await navigateToTasks(page, projectId)
        await addTaskInColumn(page, 0, matchingTask)
        await addTaskInColumn(page, 1, otherTask)
        await switchToListView(page)

        const searchInput = page.getByRole('searchbox', {
            name: 'Search tasks...',
        })

        await searchInput.fill('Alpha')
        await expect(
            page.getByRole('button', { name: matchingTask }),
        ).toBeVisible()
        await expect(
            page.getByRole('button', { name: otherTask }),
        ).toHaveCount(0)

        await searchInput.fill('No such list task value')
        await expect(page.getByText('No tasks yet', { exact: true })).toBeVisible()
        await expect(
            page.getByText(
                'Create a task to get started, or adjust your search to see matching tasks.',
                { exact: true },
            ),
        ).toBeVisible()

        await searchInput.fill('')
        await expect(
            page.getByRole('button', { name: matchingTask }),
        ).toBeVisible()
        await expect(
            page.getByRole('button', { name: otherTask }),
        ).toBeVisible()
    })

    test('preserves list column visibility preferences after reload', async ({
        page,
    }) => {
        await navigateToTasks(page, projectId)
        await switchToListView(page)

        await expect(page.getByText('Assignee', { exact: true })).toBeVisible()

        await page.getByRole('button', { name: 'Columns' }).click()
        await page.getByRole('menuitemcheckbox', { name: 'Assignee' }).click()
        await page.keyboard.press('Escape')

        await expect(page.getByText('Assignee', { exact: true })).toHaveCount(0)

        const preferencesAfterToggle = await page.evaluate((currentProjectId) => {
            const raw = window.localStorage.getItem('task-list-preferences')
            return raw ? JSON.parse(raw)[currentProjectId] : null
        }, projectId)

        expect(preferencesAfterToggle?.visibleColumns).not.toContain('assignee')

        await page.reload()
        await switchToListView(page)
        await expect(page.getByText('Assignee', { exact: true })).toHaveCount(0)
    })

    test('preserves resized list column widths after reload', async ({ page }) => {
        await navigateToTasks(page, projectId)
        await switchToListView(page)

        const descriptionResizeHandle = page.getByRole('button', {
            name: 'Resize Description column',
        })
        const initialPreferences = await page.evaluate((currentProjectId) => {
            const raw = window.localStorage.getItem('task-list-preferences')
            return raw ? JSON.parse(raw)[currentProjectId] : null
        }, projectId)
        const initialWidth = initialPreferences?.columnWidths?.description ?? 240

        const handleBox = await descriptionResizeHandle.boundingBox()
        if (!handleBox) throw new Error('Description resize handle not found')

        await page.mouse.move(
            handleBox.x + handleBox.width / 2,
            handleBox.y + handleBox.height / 2,
        )
        await page.mouse.down()
        await page.mouse.move(
            handleBox.x + handleBox.width / 2 + 80,
            handleBox.y + handleBox.height / 2,
            { steps: 10 },
        )
        await page.mouse.up()

        const resizedPreferences = await page.evaluate((currentProjectId) => {
            const raw = window.localStorage.getItem('task-list-preferences')
            return raw ? JSON.parse(raw)[currentProjectId] : null
        }, projectId)
        const resizedWidth = resizedPreferences?.columnWidths?.description

        expect(resizedWidth).toBeGreaterThan(initialWidth)

        await page.reload()
        await switchToListView(page)

        const reloadedPreferences = await page.evaluate((currentProjectId) => {
            const raw = window.localStorage.getItem('task-list-preferences')
            return raw ? JSON.parse(raw)[currentProjectId] : null
        }, projectId)

        expect(reloadedPreferences?.columnWidths?.description).toBe(resizedWidth)
    })
})
