import { expect, test, type Page } from '@playwright/test'
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

async function addTaskInColumn(
    page: Page,
    columnIndex: 0 | 1 | 2,
    taskName: string,
) {
    await page.getByRole('button', { name: 'Add Task' }).nth(columnIndex).click()
    await page.getByLabel('Task name').fill(taskName)
    await page.getByRole('button', { name: 'Create Task' }).click()
    await expect(page.getByText('Task created.').first()).toBeVisible()
}

async function sendMessage(page: Page, text: string) {
    await page.getByPlaceholder('Write Message...').fill(text)
    await page.getByPlaceholder('Write Message...').press('Enter')
}

test('archived project spaces are read-only', async ({ page }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const project = {
        title: `Archived Alpha ${suffix}`,
        description: `Archived state description ${suffix}`,
    }
    const taskTitle = `Archived Task ${suffix}`
    const messageText = `Archived message ${suffix}`

    await createProjectFromSidebar(page, project)
    await openProjectFromActiveSidebar(page, project.title)

    const match = page.url().match(/\/project\/([^/]+)/)
    const projectId = match?.[1] ?? ''

    await page.goto(`/project/${projectId}/chat`)
    await sendMessage(page, messageText)
    await expect(page.getByText(messageText, { exact: true })).toBeVisible()

    await navigateToTasks(page, projectId)
    await addTaskInColumn(page, 0, taskTitle)
    await expect(page.getByText(taskTitle, { exact: true })).toBeVisible()

    await page.goto(`/project/${projectId}`)
    await openProjectSettings(page)
    await openProjectSettingsTab(page, 'General')

    const settingsDialog = getProjectSettingsDialog(page)
    await settingsDialog.getByRole('button', { name: 'Archive' }).click()
    await page.getByRole('button', { name: 'Archive Project' }).click()
    await expect(page.getByText('Project archived successfully')).toBeVisible()

    await page.goto(`/project/${projectId}/chat`)
    await expect(
        page.getByText('Archived project - read only', { exact: true }),
    ).toBeVisible()
    await expect(
        page.getByPlaceholder('This project is archived. Chat is read-only.'),
    ).toBeVisible()
    await expect(
        page.locator('form button[type="submit"]').first(),
    ).toBeDisabled()
    await expect(
        page.getByRole('button', { name: 'Message actions' }).first(),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Message actions' }).first().click()
    await expect(
        page.getByRole('menuitem', { name: 'Copy message' }),
    ).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0)
    await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0)

    await navigateToTasks(page, projectId)
    await expect(
        page.getByText('Archived project - read only', { exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Task' })).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: 'Assign Tasks' }),
    ).toBeDisabled()
    await page.getByText(taskTitle, { exact: true }).first().click()
    await expect(
        page.getByRole('heading', { name: 'Task Details' }),
    ).toBeVisible()
    await expect(
        page.getByRole('button', { name: 'Edit Task name' }),
    ).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: 'Edit Description' }),
    ).toHaveCount(0)
    await expect(
        page.getByRole('button', { name: 'Edit Estimated Time (hours)' }),
    ).toHaveCount(0)

    await page.goto(`/project/${projectId}/whiteboard`)
    await expect(
        page.getByText('Archived project - read only', { exact: true }),
    ).toBeVisible()
})
